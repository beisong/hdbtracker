import pytest

import fetch_bto_blocks as fb
from fetch_bto_blocks import compress_street, month_index, norm_name, search_names


def test_import_does_not_run_main():
    # Module-level constants exist; main() was not executed (it would parse argv / hit OneMap).
    assert fb.OUT_PATH.endswith('bto_project_blocks.json')
    assert callable(fb.main)


class TestSearchNames:
    def test_plain_name(self):
        assert search_names('PUNGGOL REGALIA') == ['PUNGGOL REGALIA']

    def test_plain_name_with_at_town(self):
        assert search_names('JADE SPRING @ YISHUN') == ['JADE SPRING @ YISHUN']

    def test_ampersand_split(self):
        assert search_names('PUNGGOL RIPPLES & PUNGGOL SAILS') == ['PUNGGOL RIPPLES', 'PUNGGOL SAILS']

    def test_roman_numeral_pair(self):
        assert search_names('COSTA RIVIERA I & II') == ['COSTA RIVIERA I', 'COSTA RIVIERA II']

    def test_roman_numeral_pair_with_town_suffix(self):
        assert search_names('EASTLINK I & II @ CANBERRA') == [
            'EASTLINK I @ CANBERRA', 'EASTLINK II @ CANBERRA']

    def test_roman_numerals_beyond_ii(self):
        assert search_names('FOO III & IV') == ['FOO III', 'FOO IV']

    def test_comma_and_ampersand_list_shares_town_suffix(self):
        assert search_names('EASTBROOK, EASTWAVE & EASTBANK @ CANBERRA') == [
            'EASTBROOK @ CANBERRA', 'EASTWAVE @ CANBERRA', 'EASTBANK @ CANBERRA']

    def test_each_part_already_has_its_own_town(self):
        assert search_names('MEADOW SPRING @ YISHUN & BLOSSOM SPRING @ YISHUN') == [
            'MEADOW SPRING @ YISHUN', 'BLOSSOM SPRING @ YISHUN']

    def test_two_parts_town_suffix_on_last_only(self):
        assert search_names('GARDEN A & GARDEN B @ TENGAH') == [
            'GARDEN A @ TENGAH', 'GARDEN B @ TENGAH']

    @pytest.mark.parametrize('key, expected', [
        ('CORALINUS (PHASE 1)', ['CORALINUS']),
        ('CORALINUS (PHASE 12)', ['CORALINUS']),
        ('JADE SPRING @ YISHUN (PHASE 1)', ['JADE SPRING @ YISHUN']),
        ('ALEXANDRA PEAKS (DEC 2023)', ['ALEXANDRA PEAKS']),
        ('MELODY SPRING @ YISHUN (AUG 2018)', ['MELODY SPRING @ YISHUN']),
    ])
    def test_strips_phase_and_month_suffix(self, key, expected):
        assert search_names(key) == expected

    def test_suffix_strip_then_split(self):
        assert search_names('A & B (PHASE 2)') == ['A', 'B']

    def test_parenthetical_not_at_end_is_kept(self):
        assert search_names('FOO (PHASE 1) BAR') == ['FOO (PHASE 1) BAR']

    def test_other_parenthetical_is_kept(self):
        assert search_names('FOO (TOWN)') == ['FOO (TOWN)']

    def test_ampersand_without_spaces_is_not_split(self):
        assert search_names('A&B') == ['A&B']

    def test_trailing_word_after_numeral_is_not_a_numeral_pair(self):
        # "IVY" must not be read as the numeral "IV"; falls back to a plain & split.
        assert search_names('SKYLINE I & IVY') == ['SKYLINE I', 'IVY']

    def test_empty_string(self):
        assert search_names('') == []

    def test_whitespace_only(self):
        assert search_names('   ') == []

    def test_none_raises(self):
        with pytest.raises(TypeError):
            search_names(None)


class TestCompressStreet:
    @pytest.mark.parametrize('raw, expected', [
        ('BUKIT BATOK STREET 21', 'BT BATOK ST 21'),
        ('ANG MO KIO AVENUE 3', 'ANG MO KIO AVE 3'),
        ('LORONG 1 TOA PAYOH', 'LOR 1 TOA PAYOH'),
        ('UPPER BOON KENG ROAD', 'UPP BOON KENG RD'),
        ('SAINT GEORGE\'S ROAD', "ST. GEORGE'S RD"),
        ('TAMPINES NORTH DRIVE 1', 'TAMPINES NTH DR 1'),
    ])
    def test_compresses_known_words(self, raw, expected):
        assert compress_street(raw) == expected

    def test_uppercases_input(self):
        assert compress_street('bukit panjang ring road') == 'BT PANJANG RING RD'

    def test_collapses_whitespace(self):
        assert compress_street('  JURONG   WEST  STREET 91 ') == 'JURONG WEST ST 91'

    def test_already_compressed_is_unchanged(self):
        assert compress_street('BT BATOK ST 21') == 'BT BATOK ST 21'

    def test_only_whole_words_compressed(self):
        # "STREETS" / "PARKLAND" aren't dictionary words, so they're untouched.
        assert compress_street('STREETS PARKLAND') == 'STREETS PARKLAND'

    def test_empty_string(self):
        assert compress_street('') == ''

    def test_none_raises(self):
        with pytest.raises(AttributeError):
            compress_street(None)


class TestNormName:
    def test_strips_all_whitespace_and_uppercases(self):
        assert norm_name(' Punggol  Regalia ') == 'PUNGGOLREGALIA'

    def test_tabs_and_newlines(self):
        assert norm_name('A\tB\nC') == 'ABC'

    def test_spacing_variants_compare_equal(self):
        assert norm_name('SKYLINE I @ BUKIT BATOK') == norm_name('SKYLINE I@BUKIT  BATOK')

    def test_punctuation_kept(self):
        assert norm_name('a @ b') == 'A@B'

    def test_empty_string(self):
        assert norm_name('') == ''

    def test_none_raises(self):
        with pytest.raises(AttributeError):
            norm_name(None)


class TestMonthIndex:
    def test_year_month(self):
        assert month_index('2023-05') == 2023 * 12 + 4

    def test_january_and_december(self):
        assert month_index('2020-01') == 2020 * 12
        assert month_index('2020-12') == 2020 * 12 + 11

    def test_full_date_uses_only_year_month(self):
        assert month_index('2023-05-17') == month_index('2023-05')

    def test_consecutive_months_differ_by_one_across_year_end(self):
        assert month_index('2024-01') - month_index('2023-12') == 1

    def test_difference_counts_months(self):
        assert month_index('2026-11') - month_index('2021-11') == 60

    @pytest.mark.parametrize('bad', ['', '2023', '2023/05', 'abcd-ef'])
    def test_unexpected_format_raises(self, bad):
        with pytest.raises(ValueError):
            month_index(bad)

    def test_none_raises(self):
        with pytest.raises(TypeError):
            month_index(None)
