import pytest

import download_data as dd
from download_data import parse_remaining_lease, storey_midpoint


def test_import_does_not_run_main():
    assert callable(dd.main)
    assert dd.DB_PATH.endswith('.db')


class TestParseRemainingLease:
    @pytest.mark.parametrize('raw, expected', [
        ('61 years 04 months', 61.33),
        ('61 years 06 months', 61.5),
        ('94 years 11 months', 94.92),
        ('61 years', 61.0),
        ('1 year 1 month', 1.08),
        ('70 years 01 month', 70.08),
        ('  61 YEARS 04 MONTHS  ', 61.33),
    ])
    def test_text_formats(self, raw, expected):
        assert parse_remaining_lease(raw) == expected

    def test_bare_number_string(self):
        # Older datasets give remaining_lease as plain years.
        assert parse_remaining_lease('70') == 70.0

    def test_numeric_input(self):
        assert parse_remaining_lease(70) == 70.0
        assert parse_remaining_lease(61.5) == 61.5

    @pytest.mark.parametrize('empty', [None, '', 0])
    def test_empty_returns_none(self, empty):
        assert parse_remaining_lease(empty) is None

    @pytest.mark.parametrize('bad', ['years', 'years months', '   ', 'abc', 'N/A', 'sixty years'])
    def test_unparseable_returns_none(self, bad):
        assert parse_remaining_lease(bad) is None


class TestStoreyMidpoint:
    @pytest.mark.parametrize('raw, expected', [
        ('01 TO 03', 2),
        ('04 TO 06', 5),
        ('10 TO 12', 11),
        ('01 TO 05', 3),
        ('49 TO 51', 50),
        ('06 TO 10', 8),
        ('01 TO 02', 1.5),
    ])
    def test_ranges(self, raw, expected):
        assert storey_midpoint(raw) == expected

    def test_padding_around_numbers(self):
        assert storey_midpoint(' 01  TO  03 ') == 2

    @pytest.mark.parametrize('empty', [None, ''])
    def test_empty_returns_none(self, empty):
        assert storey_midpoint(empty) is None

    @pytest.mark.parametrize('bad', [
        '01-03',          # URA-style separator
        '01 to 03',       # separator is case-sensitive (HDB data is uppercase)
        '05',             # single storey
        'B1 TO 03',       # non-numeric
        '01 TO 03 TO 05', # too many parts
        'TO',
    ])
    def test_unexpected_format_returns_none(self, bad):
        assert storey_midpoint(bad) is None
