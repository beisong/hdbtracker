#!/usr/bin/env python3
"""
Map each BTO project in bto_launches.json to its actual HDB blocks, so the BTO page can
show the project's own resale transactions once it's past its 5-year MOP.

Source: OneMap search's BUILDING field carries the HDB precinct name (e.g. every block of
Punggol Regalia comes back with BUILDING = "PUNGGOL REGALIA"). Each hit's postal code is
resolved to the (block, street_name) key used by `transactions` via hdb_block_coords.

Output: scripts/bto_project_blocks.json — committed, loaded in-memory by server/index.js.
Incremental: projects already in the file are skipped (use --refresh to re-query), and
entries with "source": "manual" are never overwritten — hand-curate those for projects
OneMap doesn't know under the project's name.

OneMap throttles aggressively (fast requests come back empty / non-JSON), so requests are
spaced out and retried with backoff. Only projects plausibly past MOP are queried, newest
launch first.

Usage:
  python scripts/fetch_bto_blocks.py [--limit N] [--refresh] [--project "NAME"]
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LAUNCHES_PATH = os.path.join(SCRIPT_DIR, 'bto_launches.json')
OUT_PATH = os.path.join(SCRIPT_DIR, 'bto_project_blocks.json')
DB_PATH = os.environ.get('DB_PATH', os.path.join(SCRIPT_DIR, '..', 'server', 'db', 'resale.db'))

ONEMAP_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'
REQUEST_GAP_S = 1.5
BACKOFF_S = [5, 15, 45, 120]

# Launch → keys (~3-5y) → MOP (5y). Pre-2023 launches carry no waiting_months, so assume
# the longer end; the server decides actual MOP from lease_commence_date anyway — this
# cutoff only limits which projects are worth querying.
DEFAULT_WAIT_MONTHS = 48
MOP_MONTHS = 60

# A block's lease must start within this window of the launch year to belong to it.
# Guards against OneMap names shared with an older precinct (blocks renamed at upgrading)
# and splits one name across multiple exercises (e.g. SEGAR MEADOWS 2007 vs Jul 2011).
LEASE_WINDOW = (1, 8)
EXPECTED_BUILD_YEARS = 4
MIN_SPLIT_YEARS = 3

STREET_COMPRESSIONS = {
    'STREET': 'ST', 'AVENUE': 'AVE', 'ROAD': 'RD', 'DRIVE': 'DR',
    'CRESCENT': 'CRES', 'COURT': 'CRT', 'PLACE': 'PL', 'TERRACE': 'TERR',
    'LORONG': 'LOR', 'BUKIT': 'BT', 'KAMPONG': 'KG', 'JALAN': 'JLN',
    'UPPER': 'UPP', 'LOWER': 'LOW', 'CENTRAL': 'CTRL', 'PARK': 'PK',
    'SQUARE': 'SQ', 'GARDENS': 'GDNS', 'HEIGHTS': 'HTS', 'CLOSE': 'CL',
    'NORTH': 'NTH', 'SOUTH': 'STH', 'FARMWAY': 'FWY', 'SAINT': 'ST.',
}


def compress_street(name):
    return ' '.join(STREET_COMPRESSIONS.get(w, w) for w in name.upper().split())


def norm_name(s):
    return re.sub(r'\s+', '', s.upper())


def search_names(project):
    """OneMap building names to query for a bto_launches.json project key."""
    base = re.sub(r'\s*\((PHASE \d+|[A-Z]{3} \d{4})\)\s*$', '', project)
    # "SKYLINE I & II @ BUKIT BATOK" → "SKYLINE I @ BUKIT BATOK", "SKYLINE II @ BUKIT BATOK"
    m = re.match(r'^(.*?)\s+([IVX]+)\s*&\s*([IVX]+)\b(.*)$', base)
    if m:
        return [f'{m[1]} {m[2]}{m[4]}'.strip(), f'{m[1]} {m[3]}{m[4]}'.strip()]
    parts = [p.strip() for p in re.split(r'\s*,\s*|\s+&\s+', base) if p.strip()]
    # "EASTBROOK, EASTWAVE & EASTBANK @ CANBERRA" — the trailing "@ X" applies to every part
    suffix = re.search(r'\s@\s.+$', parts[-1]) if len(parts) > 1 else None
    if suffix:
        parts = [p if '@' in p else p + suffix[0] for p in parts]
    return parts


def onemap_search(query):
    """Exact BUILDING-name hits for query. Results are relevance-ranked, so paging stops at
    the first page without an exact hit — generic names otherwise page through hundreds."""
    results, page = [], 1
    while True:
        params = urllib.parse.urlencode({'searchVal': query, 'returnGeom': 'Y', 'getAddrDetails': 'Y', 'pageNum': page})
        data = None
        for attempt, wait in enumerate([0] + BACKOFF_S):
            if wait:
                print(f'      ⏳ OneMap throttled/failed, retrying in {wait}s (attempt {attempt + 1})')
            time.sleep(wait or REQUEST_GAP_S)
            try:
                with urllib.request.urlopen(f'{ONEMAP_URL}?{params}', timeout=20) as resp:
                    data = json.loads(resp.read())
                break
            except Exception as e:  # HTTP 429/5xx, timeouts, and throttled empty bodies all land here
                last_err = e
        if data is None:
            raise RuntimeError(f'OneMap failed for {query!r}: {last_err}')
        hits = [r for r in data.get('results', []) if norm_name(r.get('BUILDING', '')) == norm_name(query)]
        results.extend(hits)
        if not hits or page >= int(data.get('totalNumPages') or 1):
            return results
        page += 1


def load_existing():
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH) as f:
            return json.load(f)
    return {
        '_readme': (
            'BTO project -> HDB blocks, generated by scripts/fetch_bto_blocks.py from OneMap '
            'BUILDING names (street_name matches transactions.street_name). Entries with '
            '"source": "manual" are hand-curated and never overwritten by the script. '
            '"dropped" lists OneMap hits rejected by the lease-year check, for review.'
        ),
        'projects': {},
    }


def save(out):
    out['projects'] = dict(sorted(out['projects'].items()))
    tmp = OUT_PATH + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    os.replace(tmp, OUT_PATH)


def month_index(ym):
    y, m = ym[:7].split('-')
    return int(y) * 12 + int(m) - 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, help='only process the first N pending projects')
    ap.add_argument('--refresh', action='store_true', help='re-query projects already in the output file')
    ap.add_argument('--project', help='process just this project key')
    args = ap.parse_args()

    with open(LAUNCHES_PATH) as f:
        launches = json.load(f)['launches']

    conn = sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True)
    postal_to_block = {p: (b, s) for b, s, p in conn.execute(
        "SELECT block, street_name, postal FROM hdb_block_coords WHERE postal IS NOT NULL AND postal != ''")}
    lease_year = {(b, s): y for b, s, y in conn.execute("""
        SELECT block, street_name, MIN(lease_commence_date) FROM transactions
        WHERE dataset_source IS NOT 'URA_PRIVATE' AND lease_commence_date IS NOT NULL
        GROUP BY block, street_name""")}

    today_idx = date.today().year * 12 + date.today().month - 1
    candidates = []  # (launch_id, project)
    for launch in launches:
        for p in launch.get('projects', []):
            if p.get('lat') is None:  # never geocoded — mostly cancelled/never-built sites
                continue
            mop_idx = month_index(launch['launch_id']) + (p.get('waiting_months') or DEFAULT_WAIT_MONTHS) + MOP_MONTHS
            if mop_idx <= today_idx:
                candidates.append((launch['launch_id'], p['project']))
    candidates.sort(reverse=True)  # most recently MOP'd first

    # Every launch year that each OneMap name is used for, to split shared names by lease year.
    name_launch_years = {}
    for lid, proj in candidates:
        for n in search_names(proj):
            name_launch_years.setdefault(norm_name(n), set()).add(int(lid[:4]))

    out = load_existing()
    pending = [(lid, p) for lid, p in candidates
               if (args.project is None or p == args.project)
               and out['projects'].get(p, {}).get('source') != 'manual'
               and (args.refresh or p not in out['projects'])]
    if args.limit:
        pending = pending[:args.limit]
    print(f'{len(candidates)} projects past estimated MOP; {len(pending)} to query')

    stats = {'matched': 0, 'no_match': 0}
    for i, (lid, project) in enumerate(pending, 1):
        launch_year = int(lid[:4])
        blocks, dropped = {}, []
        for name in search_names(project):
            hits = onemap_search(name)
            if not hits and re.search(r'\bST\b', name):  # OneMap spells "ST GEORGE'S" as "SAINT GEORGE'S"
                hits = onemap_search(re.sub(r'\bST\b', 'SAINT', name))
            if not hits and not name.startswith('THE '):  # "PINNACLE @ DUXTON" is "THE PINNACLE@DUXTON"
                hits = onemap_search('THE ' + name)
            for r in hits:
                # Postal → our (block, street_name) key; else OneMap's own address in the DB's
                # abbreviated street form (new blocks aren't in hdb_block_coords yet). Non-flat
                # hits (MSCPs, pavilions) are kept too — they just never match a resale.
                key = postal_to_block.get(r.get('POSTAL')) or (r['BLK_NO'].upper(), compress_street(r['ROAD_NAME']))
                ly = lease_year.get(key)
                if ly is not None:
                    lo, hi = launch_year + LEASE_WINDOW[0], launch_year + LEASE_WINDOW[1]
                    shared = name_launch_years.get(norm_name(name), set())
                    closest = min(shared | {launch_year}, key=lambda y: abs(ly - EXPECTED_BUILD_YEARS - y))
                    # Phases launched close together (CORALINUS PHASE 1/2, 8 months apart) are one
                    # precinct with overlapping lease years — no reliable per-block split, so share.
                    split_away = closest != launch_year and abs(closest - launch_year) >= MIN_SPLIT_YEARS
                    if not (lo <= ly <= hi) or split_away:
                        dropped.append({'block': key[0], 'street_name': key[1], 'lease_year': ly})
                        continue
                blocks[key] = ly
        entry = {
            'source': 'onemap',
            'fetched': date.today().isoformat(),
            'launch_id': lid,
            'blocks': [{'block': b, 'street_name': s, 'lease_year': ly} for (b, s), ly in sorted(blocks.items())],
        }
        if dropped:
            entry['dropped'] = sorted(dropped, key=lambda d: (d['street_name'], d['block']))
        out['projects'][project] = entry
        save(out)
        stats['matched' if blocks else 'no_match'] += 1
        with_resale = sum(1 for ly in blocks.values() if ly is not None)
        flag = '' if blocks else '   ⚠️  NO MATCH — add a manual entry'
        print(f'[{i}/{len(pending)}] {lid} {project}: {len(blocks)} blocks ({with_resale} with resales)'
              f'{f", {len(dropped)} dropped" if dropped else ""}{flag}', flush=True)

    print(f"\nDone: {stats['matched']} matched, {stats['no_match']} with no match → {OUT_PATH}")


if __name__ == '__main__':
    sys.exit(main())
