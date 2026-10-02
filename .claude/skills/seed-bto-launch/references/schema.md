# BTO data schema & dataset conventions

Moved here from the retired `BTO.plan.md` §4 and CLAUDE.md's "Historical dataset coverage"
section (2026-10-02).

## Seed file: `scripts/bto_launches.json`

```jsonc
{
  "_readme": "...",
  "launches": [
    {
      "launch_id": "2026-06",              // YYYY-MM of the sales exercise (see same-month rule below)
      "label": "June 2026 BTO",
      "application_start": "2026-06-17",   // null for upcoming launches
      "application_end": "2026-06-24",
      "sources": ["<press release URL>", "<Annex A PDF URL>"],
      "_curation_note": "optional — sourcing caveats, estimates, reconciliations",
      "projects": [
        {
          "project": "LAKEVIEW CASCADIA",         // UPPERCASE, globally unique key (see reused names)
          "display_name": "Lakeview Cascadia",
          "town": "BISHAN",                        // must exactly match a transactions.town value
          "classification": "Prime",               // Standard|Plus|Prime; pre-Oct-2024: Non-Mature/Mature/PLH as-is; null if unannounced
          "location_desc": "Bounded by Upper Thomson Road",
          "lat": 1.36, "lng": 103.83,              // null only for never-built / unresolvable sites
          "waiting_months": 51,                    // HDB "estimated waiting time"; max of a range like "49/54"
          "flats": [
            { "bto_label": "2-Room Flexi (Type 1)", "resale_flat_type": "2 ROOM",
              "floor_area_sqm": 40, "units": 118, "price_min": 216000, "price_max": 287000 }
          ],
          // optional — HDB's own published resale comparables from Annex A (display-only)
          "hdb_quoted_resale": [
            { "resale_flat_type": "4 ROOM", "min": 840000, "max": 950000, "note": "~71y lease, 102 sqm" }
          ],
          "_curation_note": "optional",
          "_provisional_note": "required for provisional (upcoming) projects — name the source type"
        }
      ]
    }
  ]
}
```

`resale_flat_type` must exactly match `transactions.flat_type` (`'2 ROOM'`, `'3 ROOM'`, `'4 ROOM'`,
`'5 ROOM'`, `'MULTI-GENERATION'`) or be `null` for types with no resale equivalent (Studio
Apartment, 5-Room Loft) and for combined/unrecoverable-split rows.

## DB table `bto_projects` (inside `resale.db`)

One row per `flats[]` entry; a project with empty `flats[]` gets one row with `bto_label = ''` and
NULL flat fields so it still appears in listings/search. Seeded by Python `seed_bto_projects()`
(drop + recreate on every full rebuild) and by server `seedBtoProjects()` (only if the table is
missing). Never inserted into `transactions`.

```sql
CREATE TABLE IF NOT EXISTS bto_projects (
  launch_id TEXT NOT NULL, launch_label TEXT, application_start TEXT, application_end TEXT,
  project TEXT NOT NULL, display_name TEXT, town TEXT NOT NULL, classification TEXT,
  location_desc TEXT, lat REAL, lng REAL, waiting_months INTEGER,
  bto_label TEXT, resale_flat_type TEXT, floor_area_sqm REAL, units INTEGER,
  price_min INTEGER, price_max INTEGER
);
CREATE INDEX IF NOT EXISTS idx_bto_project ON bto_projects(project);
```

`hdb_quoted_resale` is not stored in the DB — the server reads it from the JSON into an in-memory
map keyed by project. **Launch status is computed** by `launchStatus()`: `upcoming` if
`application_start` is null or in the future, `open` within start/end, else `closed`.

The post-MOP block map (`scripts/bto_project_blocks.json`, keyed by the same `project` key) is
generated separately by `scripts/fetch_bto_blocks.py` — re-run it with `--project "<KEY>"` if you
rename a project key.

## Historical dataset conventions (Apr 2001 → present)

- **Coverage**: the full housingmap.sg roadmap (Apr 2001 → present) has been worked through once.
  Before assuming it's still complete after a long gap, re-verify against a fresh
  `housingmap.sg/bto/` fetch month by month, cross-referencing project *counts*, not just names
  (WebFetch summarisation can silently drop rows).
- **Pre-2010 entries are sparse by design**: `resale_flat_type: null` with prices still populated
  for unresellable types (intentional), or a combined `"<Type A> / <Type B> (split unrecoverable)"`
  placeholder row when no per-type split could be sourced.
- **Null application dates**: allowed when no source gives an exact date. `launchStatus()` only
  reports `closed` when `application_start` is set, so very old entries use a documented
  *approximate* start date (first of month, or ~2 weeks before a known close date) to avoid a false
  `upcoming` status. Safe because the frontend only displays `application_end` for closed launches.
- **Null coordinates**: allowed for projects that don't resolve in OneMap under any name — usually
  because HDB marked them cancelled and never built (e.g. two of the four April 2001 pilot sites).
  The page simply renders with no map pin.
- **Reused project names**: `project` is a global unique key (`/api/resolve` and
  `/api/bto/project-overview` filter only on it). When the same name covers two distinct exercises
  (`REDHILL PEAKS`, `ALEXANDRA PEAKS`, `TANJONG TREE RESIDENCES @ HOUGANG`, `CORALINUS`,
  `JADE SPRING @ YISHUN`, `FERNVALE VISTA`, `THE CORIS`, `SEGAR MEADOWS`), suffix **both** keys with
  `(MONTH YEAR)` or `(PHASE N)` and the matching `display_name`. Check for an existing OneMap
  collision before adding a name.
- **Same-month separate exercises**: suffix `launch_id` with a same-length letter (`2008-12a` earlier,
  `2008-12b` later) — never a day number, because `ORDER BY launch_id DESC` is a plain string sort.
- **Offered vs built**: record only units actually offered (Sembawang RiverLodge, Corporation Tiara);
  exclude Community Care Apartments from `flats[]`; reconcile the difference in `_curation_note`.
- **Don't trust housingmap.sg unit totals blindly**: several pre-2010 rows disagreed with the built
  development. Cross-check against an independent source (contemporaneous press, or a current
  listing's per-block unit count) and note any discrepancy in `_curation_note`.
