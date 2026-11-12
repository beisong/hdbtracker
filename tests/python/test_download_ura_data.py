import pytest

import download_ura_data as du
from download_ura_data import parse_contract_date, parse_floor_range, parse_tenure


def test_import_does_not_run_main():
    assert callable(du.main)


class TestParseContractDate:
    @pytest.mark.parametrize('raw, expected', [
        ('0324', '2024-03'),
        ('1225', '2025-12'),
        ('0100', '2000-01'),
        ('0698', '2098-06'),
        ('0399', '1999-03'),  # yy == 99 is treated as 1999
    ])
    def test_mmyy(self, raw, expected):
        assert parse_contract_date(raw) == expected

    @pytest.mark.parametrize('empty', [None, ''])
    def test_empty_returns_none(self, empty):
        assert parse_contract_date(empty) is None

    @pytest.mark.parametrize('bad', ['324', '03245', '2024-03', 'ab24', '03xy'])
    def test_unexpected_format_returns_none(self, bad):
        assert parse_contract_date(bad) is None


class TestParseTenure:
    def test_freehold(self):
        assert parse_tenure('Freehold') == ('FREEHOLD', None, None)

    def test_freehold_with_extra_text(self):
        assert parse_tenure('  freehold tenure ') == ('FREEHOLD', None, None)

    def test_leasehold_with_commence_year(self):
        # Remaining lease is computed against a fixed reference year (2026).
        assert parse_tenure('99 yrs lease commencing from 2007') == ('99-YR LEASEHOLD', 2007, 80)

    def test_999_year_lease(self):
        assert parse_tenure('999 yrs from 1885') == ('999-YR LEASEHOLD', 1885, 858)

    def test_years_spelled_out(self):
        assert parse_tenure('60 years from 2016') == ('60-YR LEASEHOLD', 2016, 50)

    @pytest.mark.parametrize('raw', ['99 yr from 2020', '99yrs from 2020', '99 YEAR FROM 2020'])
    def test_unit_variants(self, raw):
        assert parse_tenure(raw) == ('99-YR LEASEHOLD', 2020, 93)

    def test_expired_lease_clamped_to_zero(self):
        assert parse_tenure('30 yrs from 1980') == ('30-YR LEASEHOLD', 1980, 0)

    def test_leasehold_without_commence_year(self):
        assert parse_tenure('99 yrs') == ('99-YR LEASEHOLD', None, None)

    def test_commence_year_without_lease_length_returns_raw(self):
        assert parse_tenure('Leasehold from 2007') == ('Leasehold from 2007', None, None)

    @pytest.mark.parametrize('empty', [None, ''])
    def test_empty(self, empty):
        assert parse_tenure(empty) == (None, None, None)

    def test_unknown_format_returned_verbatim(self):
        assert parse_tenure('NA') == ('NA', None, None)


class TestParseFloorRange:
    @pytest.mark.parametrize('raw, expected', [
        ('01-05', ('01-05', 3)),
        ('06-10', ('06-10', 8)),
        ('51-55', ('51-55', 53)),
        ('01-02', ('01-02', 1.5)),
    ])
    def test_numeric_ranges(self, raw, expected):
        assert parse_floor_range(raw) == expected

    @pytest.mark.parametrize('empty', [None, '', '-'])
    def test_empty_returns_none_pair(self, empty):
        assert parse_floor_range(empty) == (None, None)

    @pytest.mark.parametrize('raw', ['B1-B5', 'B1-05', '01-05-10', '05', '01 TO 05'])
    def test_unparseable_keeps_label_without_midpoint(self, raw):
        assert parse_floor_range(raw) == (raw, None)


class TestProjectCoordsKey:
    """project_coords is keyed per (project, street): URA's generic LANDED HOUSING DEVELOPMENT
    spans hundreds of streets and a project-only key collapsed them all onto one point."""

    def _conn(self):
        import sqlite3
        conn = sqlite3.connect(':memory:')
        conn.execute('CREATE TABLE transactions (month TEXT)')
        return conn

    def _landed(self, street, x):
        return {'project': 'LANDED HOUSING DEVELOPMENT', 'street': street,
                'x': str(x), 'y': '33000', 'transaction': [{'district': '16'}]}

    def test_same_project_on_two_streets_keeps_both(self):
        conn = self._conn()
        du.add_columns_if_needed(conn)
        du.save_project_coords(conn, [self._landed('KEW CRESCENT', 40000),
                                      self._landed('JALAN CHEMPAKA KUNING', 41000)])
        rows = conn.execute('SELECT street_name FROM project_coords ORDER BY 1').fetchall()
        assert rows == [('JALAN CHEMPAKA KUNING',), ('KEW CRESCENT',)]

    def test_migrates_old_project_only_key(self):
        conn = self._conn()
        conn.execute('''CREATE TABLE project_coords (project TEXT PRIMARY KEY, street_name TEXT,
            district TEXT, market_segment TEXT, svy21_x REAL, svy21_y REAL, latitude REAL, longitude REAL)''')
        conn.execute("INSERT INTO project_coords VALUES ('SKY HABITAT', 'BISHAN ST 21', '20', 'RCR', 1, 2, 1.35, 103.8)")
        du.add_columns_if_needed(conn)
        du.save_project_coords(conn, [self._landed('KEW CRESCENT', 40000),
                                      self._landed('JALAN CHEMPAKA KUNING', 41000)])
        assert conn.execute('SELECT COUNT(*) FROM project_coords').fetchone()[0] == 3
        pk = [r[1] for r in conn.execute('PRAGMA table_info(project_coords)') if r[5]]
        assert pk == ['project', 'street_name']


class TestGeocodeMissingProjects:
    """OneMap fallback: 429s are retried with backoff, and an unknown estate name falls back
    to the street instead of failing."""

    def _resp(self, status=200, results=()):
        from unittest import mock
        import requests
        r = mock.Mock(status_code=status)
        r.json.return_value = {'results': list(results)}
        r.raise_for_status.side_effect = (
            requests.HTTPError(f'{status} Client Error') if status >= 400 else None)
        return r

    def _db(self, rows):
        import sqlite3
        conn = sqlite3.connect(':memory:')
        conn.execute('''CREATE TABLE transactions (dataset_source TEXT, project TEXT,
            street_name TEXT, district TEXT, market_segment TEXT, month TEXT)''')
        du.add_columns_if_needed(conn)
        conn.executemany("""INSERT INTO transactions (dataset_source, project, street_name, district, market_segment)
            VALUES ('URA_PRIVATE', ?, ?, '16', 'OCR')""", rows)
        return conn

    def test_falls_back_to_street_and_retries_429(self, monkeypatch):
        from unittest import mock
        monkeypatch.setattr(du.time, 'sleep', lambda s: None)
        hit = {'LATITUDE': '1.33', 'LONGITUDE': '103.94'}
        responses = {
            'CHISELHURST GREEN CHUAN LINK': [self._resp(results=[])],
            'CHISELHURST GREEN': [self._resp(results=[])],
            'CHUAN LINK': [self._resp(429), self._resp(results=[hit])],
            'HARVEY AVENUE': [self._resp(results=[hit])],
        }
        get = mock.Mock(side_effect=lambda url, params, **kw: responses[params['searchVal']].pop(0))
        monkeypatch.setattr(du.requests, 'get', get)

        conn = self._db([('CHISELHURST GREEN', 'CHUAN LINK'),
                         ('LANDED HOUSING DEVELOPMENT', 'HARVEY AVENUE')])
        assert du.geocode_missing_projects(conn) == 2
        rows = conn.execute('SELECT project, street_name, latitude FROM project_coords ORDER BY 1').fetchall()
        assert rows == [('CHISELHURST GREEN', 'CHUAN LINK', 1.33),
                        ('LANDED HOUSING DEVELOPMENT', 'HARVEY AVENUE', 1.33)]
        # Generic name: never queried with the useless project prefix
        queried = [c.kwargs['params']['searchVal'] for c in get.call_args_list]
        assert 'LANDED HOUSING DEVELOPMENT HARVEY AVENUE' not in queried

    def test_gives_up_after_repeated_429(self, monkeypatch):
        from unittest import mock
        monkeypatch.setattr(du.time, 'sleep', lambda s: None)
        monkeypatch.setattr(du.requests, 'get', mock.Mock(return_value=self._resp(429)))
        conn = self._db([('LANDED HOUSING DEVELOPMENT', 'HARVEY AVENUE')])
        assert du.geocode_missing_projects(conn) == 0
        assert conn.execute('SELECT COUNT(*) FROM project_coords').fetchone()[0] == 0

    def test_stops_when_time_budget_is_used_up(self, monkeypatch):
        from unittest import mock
        monkeypatch.setattr(du.time, 'sleep', lambda s: None)
        get = mock.Mock()
        monkeypatch.setattr(du.requests, 'get', get)
        conn = self._db([('LANDED HOUSING DEVELOPMENT', 'HARVEY AVENUE')])
        assert du.geocode_missing_projects(conn, budget_secs=0) == 0
        get.assert_not_called()

    def test_most_recent_pairs_are_geocoded_first(self, monkeypatch):
        from unittest import mock
        monkeypatch.setattr(du.time, 'sleep', lambda s: None)
        get = mock.Mock(return_value=self._resp(results=[]))
        monkeypatch.setattr(du.requests, 'get', get)
        conn = self._db([('LANDED HOUSING DEVELOPMENT', 'OLD ROAD'),
                         ('LANDED HOUSING DEVELOPMENT', 'NEW ROAD')])
        conn.execute("UPDATE transactions SET month = CASE street_name WHEN 'NEW ROAD' THEN '2026-09' ELSE '2022-01' END")
        du.geocode_missing_projects(conn)
        assert [c.kwargs['params']['searchVal'] for c in get.call_args_list] == ['NEW ROAD', 'OLD ROAD']
