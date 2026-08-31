'use strict';
const Database = require('better-sqlite3');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Cross-platform temp path (Windows has no /tmp). vitest.config.js imports this
// so the fixture DB and the server's DB_PATH always agree.
const FIXTURE_DB_PATH = path.join(os.tmpdir(), 'worthornot-test.db');

function createFixtureDb(dbPath = FIXTURE_DB_PATH) {
  // Remove existing file so we get a clean slate each test run
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE transactions (
      town TEXT,
      flat_type TEXT,
      block TEXT,
      street_name TEXT,
      storey_range TEXT,
      floor_area_sqm REAL,
      flat_model TEXT,
      remaining_lease_years INTEGER,
      resale_price INTEGER,
      price_per_sqm REAL,
      month TEXT,
      dataset_source TEXT,
      project TEXT,
      district TEXT,
      market_segment TEXT,
      type_of_sale TEXT,
      type_of_area TEXT
    );
    CREATE TABLE project_coords (
      project TEXT,
      district TEXT,
      latitude REAL,
      longitude REAL,
      street_name TEXT,
      market_segment TEXT
    );
    CREATE TABLE hdb_block_coords (
      block       TEXT NOT NULL,
      street_name TEXT NOT NULL,
      lat         REAL NOT NULL,
      lng         REAL NOT NULL,
      postal      TEXT,
      PRIMARY KEY (block, street_name)
    );
    CREATE INDEX idx_hdb_coords_latln ON hdb_block_coords(lat, lng);
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
    );
    CREATE INDEX idx_bto_project ON bto_projects(project);
  `);

  const insertTx = db.prepare(`
    INSERT INTO transactions
      (town, flat_type, block, street_name, storey_range, floor_area_sqm, flat_model,
       remaining_lease_years, resale_price, price_per_sqm, month, dataset_source,
       project, district, market_segment, type_of_sale, type_of_area)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  // HDB BEDOK — 10 rows (5 × 3 ROOM, 5 × 4 ROOM)
  const bedokHdb = [
    ['BEDOK','3 ROOM','100','BEDOK NORTH ST 1','01 TO 03',65,'MODEL A',67,280000,4307,'2024-06','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','200','BEDOK NORTH ST 1','04 TO 06',65,'MODEL A',68,285000,4384,'2024-09','HDB',null,null,null,'Resale',null],
    ['BEDOK','4 ROOM','300','BEDOK SOUTH AVE 1','01 TO 03',90,'MODEL A',72,420000,4666,'2024-09','HDB',null,null,null,'Resale',null],
    ['BEDOK','4 ROOM','400','BEDOK SOUTH AVE 1','04 TO 06',90,'MODEL A',73,430000,4777,'2024-11','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','500','BEDOK NORTH ST 1','07 TO 09',65,'MODEL A',69,290000,4461,'2025-01','HDB',null,null,null,'Resale',null],
    ['BEDOK','4 ROOM','600','BEDOK SOUTH AVE 1','07 TO 09',90,'MODEL A',74,440000,4888,'2025-01','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','700','BEDOK NORTH ST 1','10 TO 12',65,'MODEL A',70,295000,4538,'2025-03','HDB',null,null,null,'Resale',null],
    ['BEDOK','4 ROOM','800','BEDOK SOUTH AVE 1','10 TO 12',90,'MODEL A',75,450000,5000,'2025-03','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','900','BEDOK NORTH ST 1','13 TO 15',65,'MODEL A',71,298000,4584,'2025-05','HDB',null,null,null,'Resale',null],
    ['BEDOK','4 ROOM','1000','BEDOK SOUTH AVE 1','13 TO 15',90,'MODEL A',76,455000,5055,'2025-05','HDB',null,null,null,'Resale',null],
  ];

  // HDB BEDOK NORTH — 12 extra 3 ROOM rows so /api/valuation has a high-confidence
  // comp pool (≥15 comps within 500m, similar lease) for postal 460100
  const bedokNorthExtra = [
    ['BEDOK','3 ROOM','100','BEDOK NORTH ST 1','01 TO 03',65,'MODEL A',67,282000,4338,'2024-08','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','100','BEDOK NORTH ST 1','04 TO 06',65,'MODEL A',67,286000,4400,'2024-11','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','100','BEDOK NORTH ST 1','07 TO 09',65,'MODEL A',67,291000,4477,'2025-02','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','100','BEDOK NORTH ST 1','10 TO 12',65,'MODEL A',67,296000,4553,'2025-04','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','200','BEDOK NORTH ST 1','01 TO 03',65,'MODEL A',68,279000,4292,'2024-07','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','200','BEDOK NORTH ST 1','04 TO 06',65,'MODEL A',68,287000,4415,'2024-12','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','200','BEDOK NORTH ST 1','07 TO 09',65,'MODEL A',68,292000,4492,'2025-02','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','200','BEDOK NORTH ST 1','13 TO 15',65,'MODEL A',68,299000,4600,'2025-04','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','500','BEDOK NORTH ST 1','01 TO 03',65,'MODEL A',69,281000,4323,'2024-09','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','500','BEDOK NORTH ST 1','04 TO 06',65,'MODEL A',69,285000,4384,'2024-12','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','500','BEDOK NORTH ST 1','10 TO 12',65,'MODEL A',69,294000,4523,'2025-03','HDB',null,null,null,'Resale',null],
    ['BEDOK','3 ROOM','500','BEDOK NORTH ST 1','13 TO 15',65,'MODEL A',69,300000,4615,'2025-05','HDB',null,null,null,'Resale',null],
  ];

  // HDB TOA PAYOH — 8 rows (4 × 3 ROOM, 4 × 4 ROOM), district 11/12
  const toaPayohHdb = [
    ['TOA PAYOH','3 ROOM','10','TOA PAYOH RISE','01 TO 03',65,'MODEL A',55,270000,4153,'2024-06','HDB',null,'11',null,'Resale',null],
    ['TOA PAYOH','3 ROOM','20','TOA PAYOH RISE','04 TO 06',65,'MODEL A',56,275000,4230,'2024-09','HDB',null,'11',null,'Resale',null],
    ['TOA PAYOH','4 ROOM','30','TOA PAYOH CTRL 1','01 TO 03',90,'MODEL A',58,400000,4444,'2024-11','HDB',null,'11',null,'Resale',null],
    ['TOA PAYOH','4 ROOM','40','TOA PAYOH CTRL 1','04 TO 06',90,'MODEL A',59,410000,4555,'2025-01','HDB',null,'11',null,'Resale',null],
    ['TOA PAYOH','3 ROOM','50','TOA PAYOH RISE','07 TO 09',65,'MODEL A',57,280000,4307,'2025-03','HDB',null,'11',null,'Resale',null],
    ['TOA PAYOH','4 ROOM','60','TOA PAYOH CTRL 1','07 TO 09',90,'MODEL A',60,420000,4666,'2025-03','HDB',null,'11',null,'Resale',null],
    ['TOA PAYOH','3 ROOM','70','TOA PAYOH RISE','10 TO 12',65,'MODEL A',58,282000,4338,'2025-05','HDB',null,'11',null,'Resale',null],
    ['TOA PAYOH','4 ROOM','80','TOA PAYOH CTRL 1','10 TO 12',90,'MODEL A',61,425000,4722,'2025-05','HDB',null,'11',null,'Resale',null],
  ];

  // Private SKY HABITAT — 8 rows, district 11
  const skyHabitat = [
    [null,'APARTMENT',null,'BISHAN ST 21',null,60,null,null,900000,15000,'2024-06','URA_PRIVATE','SKY HABITAT','11','RCR','New Sale','Strata'],
    [null,'APARTMENT',null,'BISHAN ST 21',null,60,null,null,910000,15166,'2024-09','URA_PRIVATE','SKY HABITAT','11','RCR','New Sale','Strata'],
    [null,'APARTMENT',null,'BISHAN ST 21',null,60,null,null,920000,15333,'2024-11','URA_PRIVATE','SKY HABITAT','11','RCR','Resale','Strata'],
    [null,'APARTMENT',null,'BISHAN ST 21',null,60,null,null,930000,15500,'2025-01','URA_PRIVATE','SKY HABITAT','11','RCR','Resale','Strata'],
    [null,'CONDOMINIUM',null,'BISHAN ST 21',null,100,null,null,1200000,12000,'2025-01','URA_PRIVATE','SKY HABITAT','11','RCR','Resale','Strata'],
    [null,'APARTMENT',null,'BISHAN ST 21',null,60,null,null,940000,15666,'2025-03','URA_PRIVATE','SKY HABITAT','11','RCR','Resale','Strata'],
    [null,'APARTMENT',null,'BISHAN ST 21',null,60,null,null,950000,15833,'2025-05','URA_PRIVATE','SKY HABITAT','11','RCR','Resale','Strata'],
    [null,'CONDOMINIUM',null,'BISHAN ST 21',null,100,null,null,1220000,12200,'2025-05','URA_PRIVATE','SKY HABITAT','11','RCR','Resale','Strata'],
  ];

  // Private THE CANOPY — 4 rows, district 11
  const theCanopy = [
    [null,'CONDOMINIUM',null,'TOA PAYOH RISE',null,100,null,null,1100000,11000,'2024-09','URA_PRIVATE','THE CANOPY','11','RCR','New Sale','Strata'],
    [null,'CONDOMINIUM',null,'TOA PAYOH RISE',null,100,null,null,1120000,11200,'2025-01','URA_PRIVATE','THE CANOPY','11','RCR','Resale','Strata'],
    [null,'CONDOMINIUM',null,'TOA PAYOH RISE',null,100,null,null,1130000,11300,'2025-03','URA_PRIVATE','THE CANOPY','11','RCR','Resale','Strata'],
    [null,'CONDOMINIUM',null,'TOA PAYOH RISE',null,100,null,null,1150000,11500,'2025-05','URA_PRIVATE','THE CANOPY','11','RCR','Resale','Strata'],
  ];

  const insertAll = db.transaction((rows) => {
    for (const row of rows) insertTx.run(...row);
  });
  insertAll([...bedokHdb, ...bedokNorthExtra, ...toaPayohHdb, ...skyHabitat, ...theCanopy]);

  // Project coords
  const insertCoord = db.prepare(`
    INSERT INTO project_coords (project, district, latitude, longitude, street_name, market_segment)
    VALUES (?,?,?,?,?,?)
  `);
  insertCoord.run('SKY HABITAT', '11', 1.3521, 103.8198, 'BISHAN ST 21', 'RCR');
  insertCoord.run('THE CANOPY', '11', 1.3400, 103.8450, 'TOA PAYOH RISE', 'RCR');

  // HDB block coords — covers BEDOK fixture addresses
  const insertBlock = db.prepare(`
    INSERT INTO hdb_block_coords (block, street_name, lat, lng, postal) VALUES (?,?,?,?,?)
  `);
  insertBlock.run('100', 'BEDOK NORTH ST 1', 1.3250, 103.9300, '460100');
  insertBlock.run('200', 'BEDOK NORTH ST 1', 1.3252, 103.9302, '460200');
  insertBlock.run('500', 'BEDOK NORTH ST 1', 1.3254, 103.9304, '460500');
  insertBlock.run('700', 'BEDOK NORTH ST 1', 1.3256, 103.9306, '460700');
  insertBlock.run('900', 'BEDOK NORTH ST 1', 1.3258, 103.9308, '460900');
  // BEDOK SOUTH AVE 1 blocks — ~2km away from BEDOK NORTH ST 1
  insertBlock.run('300', 'BEDOK SOUTH AVE 1', 1.3100, 103.9200, '460300');
  insertBlock.run('400', 'BEDOK SOUTH AVE 1', 1.3102, 103.9202, '460400');

  // BTO projects — one priced (inside the BEDOK NORTH ST 1 cluster, so the 1000m
  // comps ladder finds the 3-ROOM/4-ROOM resale rows above), one upcoming (no
  // flats/coords yet).
  const insertBto = db.prepare(`
    INSERT INTO bto_projects (launch_id, launch_label, application_start, application_end,
      project, display_name, town, classification, location_desc, lat, lng, waiting_months,
      bto_label, resale_flat_type, floor_area_sqm, units, price_min, price_max)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertBtoAll = db.transaction((rows) => { for (const r of rows) insertBto.run(...r); });
  insertBtoAll([
    ['2026-06', 'June 2026 BTO', '2026-06-17', '2026-06-24', 'BEDOK VISTA CREST', 'Bedok Vista Crest', 'BEDOK', 'Standard', 'Near Bedok North', 1.3253, 103.9303, 40, '3-Room', '3 ROOM', 65, 200, 250000, 280000],
    ['2026-06', 'June 2026 BTO', '2026-06-17', '2026-06-24', 'BEDOK VISTA CREST', 'Bedok Vista Crest', 'BEDOK', 'Standard', 'Near Bedok North', 1.3253, 103.9303, 40, '4-Room', '4 ROOM', 90, 300, 320000, 360000],
    ['2026-11', 'November 2026 BTO (upcoming)', null, null, 'TOA PAYOH SUMMIT', 'Toa Payoh Summit', 'TOA PAYOH', 'Plus', 'TBD', null, null, null, '', null, null, null, null, null],
  ]);

  db.close();

  return {
    dbPath,
    cleanup() {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    },
  };
}

module.exports = { createFixtureDb, FIXTURE_DB_PATH };
