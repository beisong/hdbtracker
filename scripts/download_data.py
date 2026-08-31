#!/usr/bin/env python3
"""
Download HDB Resale Flat Price data from data.gov.sg into SQLite database.
"""

import os
import sys
import json
import time
import sqlite3
import requests
from datetime import datetime

# Dataset IDs
DATASETS = {
    'primary': 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc',       # Jan 2017 - May 2026 (PRIMARY)
}

API_BASE = 'https://data.gov.sg/api/action/datastore_search'
BATCH_SIZE = 10000

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.environ.get('DB_PATH', os.path.join(PROJECT_DIR, 'server', 'db', 'resale.db'))
DB_DIR = os.path.dirname(DB_PATH)


def ensure_db_dir():
    os.makedirs(DB_DIR, exist_ok=True)


def download_dataset(resource_id, dataset_name):
    """Download all records from a dataset using pagination."""
    all_records = []
    offset = 0
    total = None

    print(f"\n📥 Downloading dataset: {dataset_name}")
    print(f"   Resource ID: {resource_id}")

    while True:
        params = {
            'resource_id': resource_id,
            'limit': BATCH_SIZE,
            'offset': offset,
        }

        try:
            resp = requests.get(API_BASE, params=params, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"   ❌ Error at offset {offset}: {e}")
            if offset > 0:
                print(f"   Retrying in 5 seconds...")
                time.sleep(5)
                try:
                    resp = requests.get(API_BASE, params=params, timeout=60)
                    resp.raise_for_status()
                    data = resp.json()
                except Exception as e2:
                    print(f"   ❌ Retry failed: {e2}")
                    break
            else:
                break

        if not data.get('success'):
            print(f"   ❌ API returned success=false")
            break

        result = data.get('result', {})
        records = result.get('records', [])

        if total is None:
            total = result.get('total', 0)
            print(f"   Total records: {total:,}")

        if not records:
            break

        all_records.extend(records)
        offset += len(records)

        pct = (offset / total * 100) if total else 0
        print(f"   Downloaded {offset:,} / {total:,} records ({pct:.1f}%)")

        if len(records) < BATCH_SIZE:
            break

        # Small delay to be nice to the API
        time.sleep(0.3)

    print(f"   ✅ Total downloaded: {len(all_records):,} records")
    return all_records


def parse_remaining_lease(lease_str):
    """Parse remaining lease string like '61 years 04 months' to float years."""
    if not lease_str:
        return None
    try:
        parts = str(lease_str).lower().replace('years', '').replace('year', '').replace('months', '').replace('month', '').strip()
        if not parts:
            return None
        # Split on any whitespace
        tokens = parts.split()
        years = float(tokens[0]) if tokens else 0
        months = float(tokens[1]) if len(tokens) > 1 else 0
        return round(years + months / 12, 2)
    except (ValueError, IndexError):
        return None


def storey_midpoint(storey_range):
    """Get midpoint of storey range like '01 TO 03' → 2."""
    if not storey_range:
        return None
    try:
        parts = str(storey_range).split(' TO ')
        if len(parts) == 2:
            low = int(parts[0].strip())
            high = int(parts[1].strip())
            return (low + high) / 2
    except (ValueError, IndexError):
        pass
    return None


def create_database(records_by_dataset):
    """Create SQLite database with all tables."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"   Removed existing database")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    print(f"\n🗄️  Creating database at {DB_PATH}")

    # Create transactions table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month TEXT NOT NULL,
            town TEXT NOT NULL,
            flat_type TEXT NOT NULL,
            block TEXT,
            street_name TEXT,
            storey_range TEXT,
            floor_area_sqm REAL,
            flat_model TEXT,
            lease_commence_date INTEGER,
            remaining_lease_years REAL,
            resale_price INTEGER,
            price_per_sqm REAL,
            storey_midpoint REAL,
            dataset_source TEXT
        )
    ''')

    # Create indexes
    conn.execute('CREATE INDEX IF NOT EXISTS idx_transactions_town ON transactions(town)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_transactions_town_flat_type ON transactions(town, flat_type)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions(month)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_transactions_town_flat_month ON transactions(town, flat_type, month)')

    # Insert records
    total_inserted = 0
    for dataset_name, records in records_by_dataset.items():
        print(f"\n   Inserting {len(records):,} records from {dataset_name}...")

        batch = []
        batch_size = 5000
        count = 0

        for rec in records:
            floor_area = None
            try:
                floor_area = float(rec.get('floor_area_sqm', 0))
            except (ValueError, TypeError):
                pass

            price = None
            try:
                price = int(float(rec.get('resale_price', 0)))
            except (ValueError, TypeError):
                pass

            price_per_sqm = None
            if floor_area and price and floor_area > 0:
                price_per_sqm = round(price / floor_area, 2)

            lease_start = None
            try:
                lease_start = int(rec.get('lease_commence_date', 0))
            except (ValueError, TypeError):
                pass

            remaining_lease = parse_remaining_lease(rec.get('remaining_lease', ''))
            storey_mid = storey_midpoint(rec.get('storey_range', ''))

            batch.append((
                rec.get('month', ''),
                rec.get('town', '').upper(),
                rec.get('flat_type', '').upper(),
                rec.get('block', ''),
                rec.get('street_name', ''),
                rec.get('storey_range', ''),
                floor_area,
                rec.get('flat_model', ''),
                lease_start,
                remaining_lease,
                price,
                price_per_sqm,
                storey_mid,
                dataset_name,
            ))

            if len(batch) >= batch_size:
                conn.executemany('''
                    INSERT INTO transactions (month, town, flat_type, block, street_name,
                        storey_range, floor_area_sqm, flat_model, lease_commence_date,
                        remaining_lease_years, resale_price, price_per_sqm, storey_midpoint,
                        dataset_source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', batch)
                count += len(batch)
                total_inserted += len(batch)
                batch = []
                print(f"     Inserted {count:,} records...", end='\r')

        if batch:
            conn.executemany('''
                INSERT INTO transactions (month, town, flat_type, block, street_name,
                    storey_range, floor_area_sqm, flat_model, lease_commence_date,
                    remaining_lease_years, resale_price, price_per_sqm, storey_midpoint,
                    dataset_source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', batch)
            count += len(batch)
            total_inserted += len(batch)

        print(f"     ✅ Inserted {count:,} records from {dataset_name}           ")

    conn.commit()
    print(f"\n   ✅ Total records in database: {total_inserted:,}")

    # Seed HDB block coordinates and geocode any missing blocks
    seed_hdb_block_coords(conn)
    geocode_missing_hdb_blocks(conn)

    # Seed BTO launch data
    seed_bto_projects(conn)

    # Pre-compute aggregations
    compute_aggregations(conn)

    # Optimize
    conn.execute("PRAGMA optimize")
    conn.close()
    print(f"\n   ✅ Database created successfully!")


def seed_hdb_block_coords(conn):
    """Create and seed hdb_block_coords from the bundled hdb_blocks.csv."""
    import csv

    conn.execute('''
        CREATE TABLE IF NOT EXISTS hdb_block_coords (
            block       TEXT NOT NULL,
            street_name TEXT NOT NULL,
            lat         REAL NOT NULL,
            lng         REAL NOT NULL,
            postal      TEXT,
            PRIMARY KEY (block, street_name)
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_hdb_coords_latln ON hdb_block_coords(lat, lng)')

    csv_path = os.path.join(SCRIPT_DIR, 'hdb_blocks.csv')
    if not os.path.exists(csv_path):
        print(f"\n   ⚠️  hdb_blocks.csv not found at {csv_path}, skipping seed")
        return

    with open(csv_path, newline='') as f:
        # Skip comment lines before passing to DictReader
        lines = [l for l in f if not l.startswith('#')]
    reader = csv.DictReader(lines)
    rows = [
        (r['blk_no'].strip().upper(), r['street'].strip().upper(),
         float(r['lat']), float(r['lng']), r['postal'].strip())
        for r in reader if r['lat'] and r['lng']
    ]

    conn.executemany('''
        INSERT OR IGNORE INTO hdb_block_coords (block, street_name, lat, lng, postal)
        VALUES (?, ?, ?, ?, ?)
    ''', rows)
    conn.commit()
    print(f"\n   ✅ Seeded {len(rows):,} HDB block coordinates from hdb_blocks.csv")


def seed_bto_projects(conn):
    """(Re)create bto_projects from the bundled bto_launches.json.
    The JSON is the sole source of truth (unlike hdb_block_coords, which merges
    with incrementally-geocoded data) so this drops and recreates the table
    from scratch on every full rebuild.
    """
    json_path = os.path.join(SCRIPT_DIR, 'bto_launches.json')
    if not os.path.exists(json_path):
        print(f"\n   ⚠️  bto_launches.json not found at {json_path}, skipping BTO seed")
        return

    with open(json_path) as f:
        data = json.load(f)

    conn.execute('DROP TABLE IF EXISTS bto_projects')
    conn.execute('''
        CREATE TABLE bto_projects (
            launch_id         TEXT NOT NULL,
            launch_label      TEXT,
            application_start TEXT,
            application_end   TEXT,
            project           TEXT NOT NULL,
            display_name      TEXT,
            town              TEXT NOT NULL,
            classification    TEXT,
            location_desc     TEXT,
            lat               REAL,
            lng               REAL,
            waiting_months    INTEGER,
            bto_label         TEXT,
            resale_flat_type  TEXT,
            floor_area_sqm    REAL,
            units             INTEGER,
            price_min         INTEGER,
            price_max         INTEGER
        )
    ''')
    conn.execute('CREATE INDEX idx_bto_project ON bto_projects(project)')

    rows = []
    for launch in data.get('launches', []):
        for project in launch.get('projects', []):
            flats = project.get('flats') or []
            if not flats:
                # Upcoming/unpriced project — one placeholder row so it still
                # appears in listings/search.
                flats = [{'bto_label': '', 'resale_flat_type': None, 'floor_area_sqm': None,
                          'units': None, 'price_min': None, 'price_max': None}]
            for flat in flats:
                rows.append((
                    launch.get('launch_id'), launch.get('label'),
                    launch.get('application_start'), launch.get('application_end'),
                    project.get('project'), project.get('display_name'), project.get('town'),
                    project.get('classification'), project.get('location_desc'),
                    project.get('lat'), project.get('lng'), project.get('waiting_months'),
                    flat.get('bto_label'), flat.get('resale_flat_type'), flat.get('floor_area_sqm'),
                    flat.get('units'), flat.get('price_min'), flat.get('price_max'),
                ))

    conn.executemany('''
        INSERT INTO bto_projects
            (launch_id, launch_label, application_start, application_end,
             project, display_name, town, classification, location_desc,
             lat, lng, waiting_months, bto_label, resale_flat_type,
             floor_area_sqm, units, price_min, price_max)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', rows)
    conn.commit()
    print(f"\n   ✅ Seeded {len(rows):,} BTO project rows from bto_launches.json")


def geocode_missing_hdb_blocks(conn):
    """Geocode any (block, street_name) pairs in transactions not yet in hdb_block_coords."""
    rows = conn.execute('''
        SELECT DISTINCT t.block, t.street_name
        FROM transactions t
        LEFT JOIN hdb_block_coords h ON t.block = h.block AND t.street_name = h.street_name
        WHERE t.dataset_source != 'URA_PRIVATE'
          AND t.block IS NOT NULL AND t.block != ''
          AND t.street_name IS NOT NULL AND t.street_name != ''
          AND h.block IS NULL
        ORDER BY t.street_name, t.block
    ''').fetchall()

    if not rows:
        print("   ✅ No missing HDB block coordinates to geocode")
        return

    print(f"\n🌍 Geocoding {len(rows)} HDB blocks missing coordinates via OneMap...")
    ONEMAP_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'
    geocoded, failed = 0, []

    for i, (block, street) in enumerate(rows):
        query = f"BLK {block} {street}"
        for attempt in range(2):
            try:
                time.sleep(0.4)
                resp = requests.get(ONEMAP_URL, params={
                    'searchVal': query, 'returnGeom': 'Y',
                    'getAddrDetails': 'Y', 'pageNum': 1,
                }, headers={'User-Agent': 'WorthIt/1.0'}, timeout=10)
                resp.raise_for_status()
                results = resp.json().get('results', [])
                if results:
                    r = results[0]
                    lat = float(r.get('LATITUDE', 0))
                    lng = float(r.get('LONGITUDE', 0))
                    postal = r.get('POSTAL', '')
                    if lat and lng:
                        conn.execute('''
                            INSERT OR REPLACE INTO hdb_block_coords (block, street_name, lat, lng, postal)
                            VALUES (?, ?, ?, ?, ?)
                        ''', (block, street, round(lat, 7), round(lng, 7), postal))
                        geocoded += 1
                        print(f"   [{i+1}/{len(rows)}] ✅ {block} {street}: {lat:.5f}, {lng:.5f}")
                        break
                if not results or not lat:
                    if attempt == 0:
                        time.sleep(3)
                    else:
                        failed.append(f"{block} {street}")
                        print(f"   [{i+1}/{len(rows)}] ❌ {block} {street}: no results")
            except Exception as e:
                if attempt == 0:
                    time.sleep(3)
                else:
                    failed.append(f"{block} {street}")
                    print(f"   [{i+1}/{len(rows)}] ❌ {block} {street}: {e}")

    conn.commit()
    print(f"\n   ✅ Geocoded {geocoded}/{len(rows)} missing HDB blocks via OneMap")
    if failed:
        print(f"   ⚠️  {len(failed)} blocks could not be geocoded:")
        for b in failed[:10]:
            print(f"      - {b}")


def compute_aggregations(conn):
    """Pre-compute aggregations for faster API responses."""
    print(f"\n📊 Computing aggregations...")

    # Town stats
    conn.execute('DROP TABLE IF EXISTS town_stats')
    conn.execute('''
        CREATE TABLE town_stats AS
        SELECT
            town,
            flat_type,
            COUNT(*) as total_transactions,
            AVG(resale_price) as avg_price,
            MIN(resale_price) as min_price,
            MAX(resale_price) as max_price,
            AVG(price_per_sqm) as avg_psm,
            MIN(price_per_sqm) as min_psm,
            MAX(price_per_sqm) as max_psm,
            AVG(floor_area_sqm) as avg_area,
            AVG(remaining_lease_years) as avg_remaining_lease
        FROM transactions
        WHERE resale_price IS NOT NULL
        GROUP BY town, flat_type
    ''')
    conn.execute('CREATE INDEX idx_town_stats ON town_stats(town, flat_type)')

    # Monthly median prices per town per flat type (last 24 months)
    conn.execute('DROP TABLE IF EXISTS monthly_medians')
    conn.execute('''
        CREATE TABLE monthly_medians AS
        SELECT
            month,
            town,
            flat_type,
            COUNT(*) as transaction_count,
            AVG(resale_price) as avg_price,
            AVG(price_per_sqm) as avg_psm
        FROM transactions
        WHERE resale_price IS NOT NULL
        GROUP BY month, town, flat_type
        ORDER BY month DESC, town, flat_type
    ''')
    conn.execute('CREATE INDEX idx_monthly_medians ON monthly_medians(town, flat_type, month)')

    # Storey price adjustments
    conn.execute('DROP TABLE IF EXISTS storey_adjustments')
    conn.execute('''
        CREATE TABLE storey_adjustments AS
        SELECT
            town,
            flat_type,
            storey_range,
            storey_midpoint,
            COUNT(*) as transaction_count,
            AVG(price_per_sqm) as avg_psm,
            AVG(resale_price) as avg_price
        FROM transactions
        WHERE resale_price IS NOT NULL AND storey_range IS NOT NULL
        GROUP BY town, flat_type, storey_range
    ''')
    conn.execute('CREATE INDEX idx_storey_adj ON storey_adjustments(town, flat_type, storey_range)')

    conn.commit()
    print(f"   ✅ Aggregations computed")


def main():
    print("=" * 60)
    print("🏢 HDB Resale Flat Price Data Downloader")
    print("=" * 60)

    ensure_db_dir()

    records_by_dataset = {}

    # Download primary dataset (2017-2026) - always required
    primary_records = download_dataset(DATASETS['primary'], 'Primary (2017-2026)')
    if primary_records:
        records_by_dataset['primary_2017_2026'] = primary_records

    if not records_by_dataset:
        print("\n❌ No data downloaded. Exiting.")
        sys.exit(1)

    # Create database
    create_database(records_by_dataset)

    # Print summary
    print("\n" + "=" * 60)
    print("✅ Done! Database ready at:")
    print(f"   {DB_PATH}")
    print("=" * 60)


if __name__ == '__main__':
    main()