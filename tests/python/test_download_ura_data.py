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
