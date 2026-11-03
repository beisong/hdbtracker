"""
Retry / abort paths of the nightly data-refresh scripts.

The refresh must never leave a partial DB behind: any page/batch that still
fails after retries must exit non-zero with the existing DB untouched.

No network: requests.get is mocked. Needs requirements.txt installed.
Run from the repo root:
    python -m unittest discover -s tests/python -v
"""

import os
import sqlite3
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))

import download_data  # noqa: E402
import download_ura_data  # noqa: E402


class FakeResp:
    def __init__(self, payload, status_ok=True):
        self.payload = payload
        self.status_ok = status_ok
        self.text = str(payload)

    def raise_for_status(self):
        if not self.status_ok:
            raise Exception('HTTP 500')

    def json(self):
        return self.payload


def hdb_record(i):
    return dict(month='2024-01', town='ANG MO KIO', flat_type='4 ROOM', block=str(i),
                street_name='ANG MO KIO AVE 1', storey_range='01 TO 03', floor_area_sqm='90',
                flat_model='Improved', lease_commence_date='1980',
                remaining_lease='55 years 01 month', resale_price='500000')


def ura_project(name):
    return {
        'project': name, 'street': 'TEST ST', 'marketSegment': 'OCR', 'x': '30000', 'y': '30000',
        'transaction': [{
            'contractDate': '0124', 'district': '05', 'price': '1000000', 'area': '100',
            'propertyType': 'Condominium', 'tenure': 'Freehold', 'floorRange': '01-05',
        }],
    }


class DbTestCase(unittest.TestCase):
    """Temp DB pre-filled with 5 HDB + 3 URA rows, so 'untouched' is checkable."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.tmp.name, 'resale.db')
        conn = sqlite3.connect(self.db)
        conn.execute('''CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT, town TEXT, flat_type TEXT,
            block TEXT, street_name TEXT, storey_range TEXT, floor_area_sqm REAL,
            flat_model TEXT, lease_commence_date INTEGER, remaining_lease_years REAL,
            resale_price INTEGER, price_per_sqm REAL, storey_midpoint REAL, dataset_source TEXT)''')
        conn.executemany('INSERT INTO transactions (dataset_source) VALUES (?)',
                         [('old_hdb',)] * 5 + [('URA_PRIVATE',)] * 3)
        conn.commit()
        conn.close()
        for mod in (download_data, download_ura_data):
            p = mock.patch.multiple(mod, DB_PATH=self.db, DB_DIR=self.tmp.name)
            p.start()
            self.addCleanup(p.stop)
        p = mock.patch('time.sleep')  # no real backoff waits
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def counts(self):
        conn = sqlite3.connect(self.db)
        hdb, ura = conn.execute(
            "SELECT COALESCE(SUM(dataset_source != 'URA_PRIVATE'), 0), "
            "COALESCE(SUM(dataset_source = 'URA_PRIVATE'), 0) FROM transactions").fetchone()
        conn.close()
        return hdb, ura

    def run_main(self, mod):
        with mock.patch('builtins.print'):
            try:
                mod.main()
            except SystemExit as e:
                return e.code
        return 0


class TestHdbDownload(DbTestCase):
    TOTAL = 5  # with BATCH_SIZE=2 → pages at offsets 0, 2, 4

    def setUp(self):
        super().setUp()
        for name, value in (('BATCH_SIZE', 2),
                            ('geocode_missing_hdb_blocks', lambda conn: None)):
            p = mock.patch.object(download_data, name, value)
            p.start()
            self.addCleanup(p.stop)

    def fake_get(self, fail_offset=None, fail_times=0, short_by=0, success=True):
        failures = {'n': 0}

        def get(url, params=None, **kwargs):
            offset = params['offset']
            if offset == fail_offset and failures['n'] < fail_times:
                failures['n'] += 1
                return FakeResp({}, status_ok=False)
            available = self.TOTAL - short_by
            recs = [hdb_record(i) for i in range(offset, min(offset + 2, available))]
            return FakeResp({'success': success, 'result': {'total': self.TOTAL, 'records': recs}})
        return get

    def run_with(self, get):
        with mock.patch.object(download_data.requests, 'get', side_effect=get) as m:
            code = self.run_main(download_data)
        return code, m.call_count

    def test_middle_page_fails_all_retries_exits_1_and_keeps_db(self):
        code, _ = self.run_with(self.fake_get(fail_offset=2, fail_times=3))
        self.assertEqual(code, 1)
        self.assertEqual(self.counts(), (5, 3))

    def test_first_page_is_retried_too(self):
        code, calls = self.run_with(self.fake_get(fail_offset=0, fail_times=3))
        self.assertEqual(code, 1)
        self.assertEqual(calls, download_data.MAX_ATTEMPTS)
        self.assertEqual(self.counts(), (5, 3))

    def test_success_false_exits_1_and_keeps_db(self):
        code, _ = self.run_with(self.fake_get(success=False))
        self.assertEqual(code, 1)
        self.assertEqual(self.counts(), (5, 3))

    def test_fewer_records_than_total_exits_1_and_keeps_db(self):
        code, _ = self.run_with(self.fake_get(short_by=1))
        self.assertEqual(code, 1)
        self.assertEqual(self.counts(), (5, 3))

    def test_transient_failure_recovers_and_builds_full_db(self):
        code, _ = self.run_with(self.fake_get(fail_offset=2, fail_times=2))
        self.assertEqual(code, 0)
        self.assertEqual(self.counts(), (self.TOTAL, 0))
        conn = sqlite3.connect(self.db)
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        plan = conn.execute("EXPLAIN QUERY PLAN SELECT * FROM transactions "
                            "WHERE block = '1' AND street_name = 'X'").fetchall()
        conn.close()
        self.assertFalse(tables & {'town_stats', 'monthly_medians', 'storey_adjustments'})
        self.assertIn('idx_transactions_block_street', str(plan))


class TestUraDownload(DbTestCase):
    def setUp(self):
        super().setUp()
        p = mock.patch.dict(os.environ, {'URA_API_ACCESS_KEY': 'test-key'})
        p.start()
        self.addCleanup(p.stop)
        p = mock.patch.object(download_ura_data, 'geocode_missing_projects', lambda conn: 0)
        p.start()
        self.addCleanup(p.stop)

    def fake_get(self, fail_batch=None, fail_times=0):
        failures = {'n': 0}

        def get(url, params=None, **kwargs):
            if 'insertNewToken' in url:
                return FakeResp({'Status': 'Success', 'Result': 'token-' * 5})
            b = params['batch']
            if b == fail_batch and failures['n'] < fail_times:
                failures['n'] += 1
                return FakeResp({'Status': 'Error', 'Message': 'boom'})
            return FakeResp({'Status': 'Success',
                             'Result': [ura_project(f'P{b}')]})
        return get

    def run_with(self, get):
        with mock.patch.object(download_ura_data.requests, 'get', side_effect=get):
            return self.run_main(download_ura_data)

    def test_batch_fails_all_retries_exits_1_and_keeps_old_ura_rows(self):
        self.assertEqual(self.run_with(self.fake_get(fail_batch=3, fail_times=3)), 1)
        self.assertEqual(self.counts(), (5, 3))

    def test_insert_error_rolls_back_and_keeps_old_ura_rows(self):
        # All downloads succeed; batches 1-3 insert fine, then batch 4's insert
        # raises → the whole delete+insert must roll back.
        real_insert = download_ura_data.insert_transactions

        def flaky_insert(conn, projects, batch_num):
            if batch_num == 4:
                raise ValueError('simulated insert failure')
            return real_insert(conn, projects, batch_num)

        with mock.patch.object(download_ura_data, 'insert_transactions', side_effect=flaky_insert):
            self.assertEqual(self.run_with(self.fake_get()), 1)
        self.assertEqual(self.counts(), (5, 3))

    def test_transient_failure_recovers_and_replaces_ura_rows(self):
        self.assertEqual(self.run_with(self.fake_get(fail_batch=1, fail_times=2)), 0)
        self.assertEqual(self.counts(), (5, 4))  # 3 old rows replaced by 1 per batch
        conn = sqlite3.connect(self.db)
        indexes = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='index'")}
        conn.close()
        self.assertTrue({'idx_transactions_project', 'idx_transactions_district',
                         'idx_transactions_source'} <= indexes)


if __name__ == '__main__':
    unittest.main()
