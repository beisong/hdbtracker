#!/usr/bin/env python3
"""
Download URA Private Residential Property Transaction data into SQLite database.
Adds data to the existing HDB database with compatible schema.
"""

import os
import sys
import json
import time
import sqlite3
import requests
from datetime import datetime
from pyproj import Transformer

# SVY21 → WGS84 transformer
transformer = Transformer.from_crs('EPSG:3414', 'EPSG:4326', always_xy=True)

# URA API config
URA_API_BASE = 'https://eservice.ura.gov.sg/uraDataService'
URA_SERVICE = 'PMI_Resi_Transaction'
BATCHES = [1, 2, 3, 4]
# URA placeholder project names that cover many unrelated streets (keep in sync with app.js)
GENERIC_PROJECT_NAMES = {'LANDED HOUSING DEVELOPMENT', 'RESIDENTIAL APARTMENTS'}
MAX_ATTEMPTS = 3          # per batch: 1 initial request + 2 retries
RETRY_BACKOFF_SECS = 10   # 10s, then 20s

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.environ.get('DB_PATH', os.path.join(PROJECT_DIR, 'server', 'db', 'resale.db'))
DB_DIR = os.path.dirname(DB_PATH)
ENV_PATH = os.path.join(PROJECT_DIR, '.env')


def get_ura_access_key():
    """Read URA access key from environment variable or .env file."""
    # Check environment variable first (set via fly secrets on production)
    env_key = os.environ.get('URA_API_ACCESS_KEY')
    if env_key:
        return env_key

    # Fallback to .env file for local development
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if line.startswith('URA_API_ACCESS_KEY='):
                    return line.split('=', 1)[1].strip()
    
    print("❌ URA_API_ACCESS_KEY not found in environment or .env")
    sys.exit(1)


def get_daily_token(access_key):
    """Generate a daily token from URA API."""
    print("🔑 Generating daily URA API token...")
    url = f'{URA_API_BASE}/insertNewToken/v1'
    resp = requests.get(url, headers={
        'AccessKey': access_key,
        'User-Agent': 'WorthIt/1.0',
        'Accept': 'application/json',
    }, timeout=15)
    resp.raise_for_status()
    # Debug: print response if not JSON
    try:
        data = resp.json()
    except Exception:
        print(f"   Response text: {resp.text[:200]}")
        raise
    if data.get('Status') != 'Success':
        raise Exception(f"Token request failed: {data.get('Message', 'Unknown error')}")
    token = data['Result']
    print(f"   ✅ Token generated: {token[:20]}...")
    return token


def download_batch(access_key, token, batch_num):
    """Download one batch of URA transaction data."""
    url = f'{URA_API_BASE}/invokeUraDS/v1'
    params = {'service': URA_SERVICE, 'batch': batch_num}
    headers = {
        'AccessKey': access_key,
        'Token': token,
        'User-Agent': 'WorthIt/1.0',
        'Accept': 'application/json',
    }

    print(f"\n📥 Downloading batch {batch_num}...")
    resp = requests.get(url, params=params, headers=headers, timeout=120)
    resp.raise_for_status()
    try:
        data = resp.json()
    except Exception:
        print(f"   Response text: {resp.text[:200]}")
        raise

    if data.get('Status') != 'Success':
        raise Exception(f"Batch {batch_num} failed: {data.get('Message', 'Unknown error')}")

    projects = data.get('Result', [])
    total_tx = sum(len(p.get('transaction', [])) for p in projects)
    print(f"   ✅ Batch {batch_num}: {len(projects)} projects, {total_tx:,} transactions")
    return projects


def download_batch_with_retry(access_key, token, batch_num):
    """download_batch() with retries; re-raises the last error after MAX_ATTEMPTS."""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return download_batch(access_key, token, batch_num)
        except Exception as e:
            print(f"   ❌ Batch {batch_num} error (attempt {attempt}/{MAX_ATTEMPTS}): {e}")
            if attempt == MAX_ATTEMPTS:
                raise
            wait = RETRY_BACKOFF_SECS * attempt
            print(f"   Retrying in {wait} seconds...")
            time.sleep(wait)


def parse_contract_date(date_str):
    """Convert URA contractDate 'MMYY' to 'YYYY-MM' format."""
    if not date_str or len(date_str) != 4:
        return None
    try:
        mm = int(date_str[:2])
        yy = int(date_str[2:])
        # Assume 2000s for yy < 100, 1900s for yy >= 99
        yyyy = 2000 + yy if yy < 99 else 1900 + yy
        return f'{yyyy}-{mm:02d}'
    except (ValueError, IndexError):
        return None


def parse_tenure(tenure_str):
    """Parse tenure string to extract lease years and commence date."""
    if not tenure_str:
        return None, None, None  # flat_model, lease_commence_date, remaining_lease_years

    tenure_upper = tenure_str.upper().strip()

    if 'FREEHOLD' in tenure_upper:
        return 'FREEHOLD', None, None

    # Extract lease years (e.g., "99 yrs", "999 yrs", "60 years")
    import re
    years_match = re.search(r'(\d+)\s*(?:YRS?|YEARS?)', tenure_upper)
    lease_years = int(years_match.group(1)) if years_match else None

    # Extract commence year (e.g., "from 2007", "commencing from 1995")
    commence_match = re.search(r'FROM\s+(\d{4})', tenure_upper)
    commence_year = int(commence_match.group(1)) if commence_match else None

    if lease_years and commence_year:
        # Compute remaining lease as of 2026
        remaining = lease_years - (2026 - commence_year)
        return f'{lease_years}-YR LEASEHOLD', commence_year, max(0, remaining)
    elif lease_years:
        return f'{lease_years}-YR LEASEHOLD', None, None

    return tenure_str, None, None


def parse_floor_range(floor_range):
    """Parse floor range like '01-05' to storey_range and midpoint."""
    if not floor_range or floor_range == '-':
        return None, None
    try:
        parts = floor_range.split('-')
        if len(parts) == 2:
            low = int(parts[0].strip())
            high = int(parts[1].strip())
            mid = (low + high) / 2
            return floor_range, mid
    except (ValueError, IndexError):
        pass
    return floor_range, None


def add_columns_if_needed(conn):
    """Add private-property-specific columns to the transactions table."""
    # Check existing columns
    cursor = conn.execute("PRAGMA table_info(transactions)")
    existing = {row[1] for row in cursor.fetchall()}

    new_columns = [
        ('district', 'TEXT'),
        ('market_segment', 'TEXT'),
        ('type_of_sale', 'TEXT'),
        ('project', 'TEXT'),
        ('type_of_area', 'TEXT'),
    ]

    for col_name, col_type in new_columns:
        if col_name not in existing:
            conn.execute(f'ALTER TABLE transactions ADD COLUMN {col_name} {col_type}')
            print(f"   Added column: {col_name} ({col_type})")

    # Keyed by (project, street): generic URA names like LANDED HOUSING DEVELOPMENT
    # span hundreds of streets, so a project-only key collapsed them into one point.
    pk_cols = {row[1] for row in conn.execute("PRAGMA table_info(project_coords)") if row[5]}
    if pk_cols == {'project'}:
        print("   Migrating project_coords to (project, street_name) key")
        conn.execute('ALTER TABLE project_coords RENAME TO project_coords_old')

    # Create project_coords table for storing SVY21→WGS84 converted coordinates
    conn.execute('''
        CREATE TABLE IF NOT EXISTS project_coords (
            project TEXT NOT NULL,
            street_name TEXT NOT NULL DEFAULT '',
            district TEXT,
            market_segment TEXT,
            svy21_x REAL,
            svy21_y REAL,
            latitude REAL,
            longitude REAL,
            PRIMARY KEY (project, street_name)
        )
    ''')
    if pk_cols == {'project'}:
        conn.execute('''
            INSERT OR IGNORE INTO project_coords
            SELECT project, COALESCE(street_name, ''), district, market_segment,
                   svy21_x, svy21_y, latitude, longitude
            FROM project_coords_old
        ''')
        conn.execute('DROP TABLE project_coords_old')

    conn.commit()


def save_project_coords(conn, all_projects):
    """Extract SVY21 coordinates from URA projects, convert to WGS84, and store."""
    count = 0
    for project_data in all_projects:
        project_name = project_data.get('project', '')
        street = project_data.get('street', '') or ''
        market_segment = project_data.get('marketSegment', '')
        x_str = project_data.get('x', '')
        y_str = project_data.get('y', '')

        if not x_str or not y_str or not project_name:
            continue

        try:
            svy21_x = float(x_str)
            svy21_y = float(y_str)
        except (ValueError, TypeError):
            continue

        # Convert SVY21 to WGS84 (lat/lng)
        try:
            lng, lat = transformer.transform(svy21_x, svy21_y)
        except Exception:
            continue

        # Get district from first transaction
        district = ''
        transactions = project_data.get('transaction', [])
        if transactions:
            district = transactions[0].get('district', '')

        conn.execute('''
            INSERT OR REPLACE INTO project_coords (project, street_name, district, market_segment, svy21_x, svy21_y, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (project_name, street, district, market_segment, svy21_x, svy21_y, round(lat, 7), round(lng, 7)))
        count += 1

    return count


def insert_transactions(conn, all_projects, batch_num):
    """Parse URA projects and insert into transactions table."""
    count = 0
    batch = []
    batch_size = 2000

    for project_data in all_projects:
        project_name = project_data.get('project', '')
        street = project_data.get('street', '')
        market_segment = project_data.get('marketSegment', '')
        x = project_data.get('x', '')
        y = project_data.get('y', '')

        transactions = project_data.get('transaction', [])

        for tx in transactions:
            month = parse_contract_date(tx.get('contractDate', ''))
            if not month:
                continue

            district = tx.get('district', '')
            town = f'D{district}' if district else ''

            price = None
            try:
                price = int(float(tx.get('price', 0)))
            except (ValueError, TypeError):
                pass

            area = None
            try:
                area = float(tx.get('area', 0))
            except (ValueError, TypeError):
                pass

            type_of_area = tx.get('typeOfArea', '')

            price_per_sqm = None
            if area and price and area > 0:
                price_per_sqm = round(price / area, 2)

            property_type = tx.get('propertyType', '')
            flat_model, lease_commence, remaining_lease = parse_tenure(tx.get('tenure', ''))
            storey_range, storey_mid = parse_floor_range(tx.get('floorRange', ''))

            type_of_sale = tx.get('typeOfSale', '')
            no_of_units = tx.get('noOfUnits', '1')
            try:
                no_of_units = int(no_of_units)
            except (ValueError, TypeError):
                no_of_units = 1

            batch.append((
                month,
                town,
                property_type.upper() if property_type else '',
                project_name,  # block field → project name
                street,
                storey_range,
                area,
                flat_model or '',
                lease_commence,
                remaining_lease,
                price,
                price_per_sqm,
                storey_mid,
                'URA_PRIVATE',
                district,
                market_segment,
                type_of_sale,
                project_name,
                type_of_area,
            ))

            if len(batch) >= batch_size:
                conn.executemany('''
                    INSERT INTO transactions (month, town, flat_type, block, street_name,
                        storey_range, floor_area_sqm, flat_model, lease_commence_date,
                        remaining_lease_years, resale_price, price_per_sqm, storey_midpoint,
                        dataset_source, district, market_segment, type_of_sale, project, type_of_area)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', batch)
                count += len(batch)
                batch = []
                print(f"     Batch {batch_num}: Inserted {count:,} transactions...", end='\r')

    if batch:
        conn.executemany('''
            INSERT INTO transactions (month, town, flat_type, block, street_name,
                storey_range, floor_area_sqm, flat_model, lease_commence_date,
                remaining_lease_years, resale_price, price_per_sqm, storey_midpoint,
                dataset_source, district, market_segment, type_of_sale, project, type_of_area)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', batch)
        count += len(batch)

    print(f"     ✅ Batch {batch_num}: Inserted {count:,} transactions           ")
    return count


ONEMAP_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'
ONEMAP_GAP_SECS = 1.0                    # OneMap silently rate-limits; 0.4s triggered 429s
ONEMAP_429_BACKOFF_SECS = (5, 15, 30, 60)
# The nightly rebuilds the DB from scratch and re-geocodes every missing pair; cap the time so
# OneMap slowness can't push the workflow past its 30-min timeout. Skipped pairs just get no pin.
GEOCODE_BUDGET_SECS = 600


def onemap_search(query):
    """Return (lat, lng) of OneMap's top hit for query, or None if it has no usable result.
    Retries 429 / network errors with backoff; raises once the retries are exhausted."""
    for backoff in (*ONEMAP_429_BACKOFF_SECS, None):
        time.sleep(ONEMAP_GAP_SECS)
        try:
            resp = requests.get(ONEMAP_URL, params={
                'searchVal': query,
                'returnGeom': 'Y',
                'getAddrDetails': 'N',
                'pageNum': 1,
            }, headers={'User-Agent': 'WorthIt/1.0'}, timeout=10)
            resp.raise_for_status()
            results = resp.json().get('results', [])
        except Exception as e:
            if backoff is None:
                raise
            print(f"      ⚠️  OneMap error for '{query}': {e} — waiting {backoff}s")
            time.sleep(backoff)
            continue
        if not results:
            return None
        lat = float(results[0].get('LATITUDE', 0) or 0)
        lng = float(results[0].get('LONGITUDE', 0) or 0)
        return (lat, lng) if lat and lng else None


def geocode_missing_projects(conn, budget_secs=GEOCODE_BUDGET_SECS):
    """Use OneMap API to geocode projects missing from project_coords, most recently
    transacted first, stopping once budget_secs have elapsed."""
    rows = conn.execute('''
        SELECT t.project, t.street_name, t.district, t.market_segment
        FROM transactions t
        LEFT JOIN project_coords pc
          ON t.project = pc.project AND COALESCE(t.street_name, '') = pc.street_name
        WHERE t.dataset_source = 'URA_PRIVATE'
          AND t.project IS NOT NULL AND t.project != ''
          AND pc.project IS NULL
        GROUP BY t.project, t.street_name
        ORDER BY MAX(t.month) DESC, t.project
    ''').fetchall()

    if not rows:
        print("   ✅ No missing project coordinates to geocode")
        return 0

    print(f"\n🌍 Geocoding {len(rows)} projects missing coordinates via OneMap...")
    geocoded = 0
    failed = []
    deadline = time.monotonic() + budget_secs

    for i, (project, street, district, market_segment) in enumerate(rows):
        if time.monotonic() >= deadline:
            print(f"   ⏱️  Geocoding budget ({budget_secs}s) used up — skipping the remaining "
                  f"{len(rows) - i} pairs (no map pin until a later run)")
            break
        street = street or ''
        label = f"{project} / {street}"
        # Most specific first. OneMap often doesn't know an estate name, so fall back to the
        # street (accurate enough for a landed street); generic URA names go straight to it.
        if project in GENERIC_PROJECT_NAMES:
            queries = [street]
        else:
            queries = [f"{project} {street}".strip(), project, street]
        queries = [q for j, q in enumerate(queries) if q and q not in queries[:j]]

        hit = None
        try:
            for query in queries:
                hit = onemap_search(query)
                if hit:
                    break
        except Exception as e:
            failed.append(label)
            print(f"   [{i+1}/{len(rows)}] ❌ {label}: {e}")
            continue

        if not hit:
            failed.append(label)
            print(f"   [{i+1}/{len(rows)}] ❌ {label}: no results")
            continue

        lat, lng = hit
        conn.execute('''
            INSERT OR REPLACE INTO project_coords
                (project, street_name, district, market_segment, svy21_x, svy21_y, latitude, longitude)
            VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
        ''', (project, street, district, market_segment, round(lat, 7), round(lng, 7)))
        geocoded += 1
        via = '' if query == queries[0] else f" (via '{query}')"
        print(f"   [{i+1}/{len(rows)}] ✅ {label}: {lat:.5f}, {lng:.5f}{via}")

    conn.commit()
    print(f"\n   ✅ Geocoded {geocoded}/{len(rows)} projects via OneMap")
    if failed:
        print(f"   ⚠️  {len(failed)} projects could not be geocoded:")
        for p in failed:
            print(f"      - {p}")
    return geocoded


def main():
    print("=" * 60)
    print("🏢 URA Private Property Transaction Data Downloader")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"\n❌ Database not found at {DB_PATH}")
        print("   Run download_data.py first to create the HDB database.")
        sys.exit(1)

    access_key = get_ura_access_key()
    token = get_daily_token(access_key)

    # Download ALL batches before touching the database. If any batch still
    # fails after retries, exit non-zero with the DB untouched — never write a
    # DB with only some (or none) of the private data.
    batches = {}
    for batch_num in BATCHES:
        try:
            batches[batch_num] = download_batch_with_retry(access_key, token, batch_num)
        except Exception as e:
            print(f"\n❌ URA batch {batch_num} failed after {MAX_ATTEMPTS} attempts: {e}")
            print("   Aborting without modifying the database.")
            sys.exit(1)

    # Connect to existing database
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    # Schema changes first (idempotent, safe to commit on their own)
    print("\n📋 Checking database schema...")
    add_columns_if_needed(conn)

    # Replace URA rows in ONE transaction: if anything below raises, roll back
    # so the old private data survives and the script exits non-zero.
    total_inserted = 0
    total_coords = 0
    try:
        existing_ura = conn.execute(
            "SELECT COUNT(*) FROM transactions WHERE dataset_source = 'URA_PRIVATE'"
        ).fetchone()[0]
        if existing_ura > 0:
            print(f"\n⚠️  Replacing {existing_ura:,} existing URA records...")
            conn.execute("DELETE FROM transactions WHERE dataset_source = 'URA_PRIVATE'")

        for batch_num, projects in batches.items():
            total_inserted += insert_transactions(conn, projects, batch_num)
            total_coords += save_project_coords(conn, projects)
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"\n❌ Failed while inserting URA data: {e}")
        print("   Rolled back; existing private data left unchanged.")
        sys.exit(1)

    print(f"\n📍 Saved coordinates for {total_coords:,} projects")

    # Geocode any projects still missing coordinates via OneMap
    geocode_missing_projects(conn)

    # Indexes for private property lookups
    conn.execute('CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(project)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_transactions_district ON transactions(district)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(dataset_source)')
    conn.commit()

    # Optimize
    conn.execute("PRAGMA optimize")
    conn.close()

    print(f"\n{'=' * 60}")
    print(f"✅ Done! Added {total_inserted:,} private property transactions")
    print(f"   Database: {DB_PATH}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()