---
name: seed-bto-launch
description: Curate and seed a new HDB BTO launch into scripts/bto_launches.json (official or provisional). Use when the user asks to add/seed/backfill a BTO launch, e.g. "seed the <Month Year> BTO launch" or "add the upcoming <Month Year> exercise as provisional".
---

# Seed a BTO launch

Battle-tested runbook for adding one HDB BTO launch exercise to
`scripts/bto_launches.json`. Follow in order — every gotcha below was hit for real at least once
across the 20+ launches seeded so far (back to Feb 2021; pre-Oct-2024 launches use the older
Non-Mature/Mature Town(s)/PLH classification system instead of Standard/Plus/Prime — preserve the
real historical label as-is, don't force-map it).

Read `references/schema.md` (JSON schema, DB table, and historical dataset conventions) before
starting if this is the first time running this skill in a session.

## Is this an official or provisional launch?

- **Official** (HDB has published a press release + Annex A): follow steps 1–8 below.
- **Provisional** (not yet launched, only third-party BTO-preview-tracker rumors exist): skip to
  **Provisional launches** at the bottom — do not fabricate per-flat-type data.

## 1. Find the press release and Annex A

Search: `HDB <Month> <Year> BTO sales exercise press release`. Canonical URL pattern:
`https://www.hdb.gov.sg/hdb-pulse/news/<year>/<slug>`.

Annex A (pricing) URL — **try in this order, don't assume**:
1. `https://www.hdb.gov.sg/-/media/hdb-pulse/news/<year>/<press-release-slug>/Annex-A.pdf`
2. If that 404s (comes back as HTML, not a PDF — always check with `file` after downloading, never
   trust a 200 status alone), search `"hdb.gov.sg" <month> <year> BTO "Annex-A" site:hdb.gov.sg`.
   Real variants hit before: a date-suffixed `Annex-A-20250723.pdf`, and a launch with a totally
   different naming scheme (`Annex-ABTO-sales-exercise-Oct-2025.pdf`) whose admin-dates annex was
   **Annex C**, not the usual Annex B.
3. Admin-details annex (application dates) is usually Annex B, but check the search-result title —
   search `"hdb.gov.sg" <month> <year> BTO "Annex-B" OR "Annex-C" site:hdb.gov.sg` if unsure. Search
   results can point at a stale/wrong URL (seen: a plausible-looking `/-/media/doc/SCEG/...` path
   that 404s) — if the search-result URL 404s, retry it in the *same folder* as the Annex A URL that
   already worked, just swapping the filename (e.g. `.../<press-release-slug>/Annex-B.pdf`), before
   trying anything else.

Download **both** PDFs (pricing annex + admin-details annex) directly into
`/Users/weisong/Video/WorthOrNot/bto_launches_info/`, not the scratchpad — this repo directory is
the permanent archive the user references later. Name them
`<launch_id>-annex-<letter>-<short-description>.pdf` using the exact `launch_id` (`YYYY-MM`) as the
prefix, e.g. `2025-02-annex-a-pricing-details.pdf`, `2025-02-annex-b-admin-details.pdf`.

**If two genuinely separate BTO exercises land in the same calendar month** (confirmed for Dec 2008:
Dew Spring @ Yishun launched 18 Dec 2008 / closed 31 Dec 2008, while Sunshine Court + Punggol Regalia
launched separately on 30 Dec 2008 / closed 12 Jan 2009 — confirmed distinct because the official
Sunshine Court/Punggol Regalia press release doesn't mention Dew Spring at all), **do not suffix the
launch_id with a day number** (`2008-12-18`) — every `/api/bto/launches` query sorts
`ORDER BY launch_id DESC` as a plain string, and a day-suffixed id sorts *after* the bare `YYYY-MM`
sibling regardless of which is chronologically later (`"2008-12" < "2008-12-18"` lexicographically
even though Dec 18 is earlier in the month), which silently puts the older launch above the newer
one in every "most recent first" listing. Instead suffix both with a same-length letter,
earlier-in-month = `a`, later-in-month = `b` (`2008-12a` for Dew Spring, `2008-12b` for Sunshine
Court/Punggol Regalia) — `"2008-12b" > "2008-12a"` sorts correctly. Verify with a quick
`ORDER BY launch_id DESC` spot-check (or `/api/bto/launches` and check the order) after adding either
one, not just the JSON reconciliation.

Verify PDF downloads with
`file <name>.pdf` before parsing — a 404 or bot-block often silently downloads as an HTML error page
with a `.pdf` extension. `file` only checks magic bytes, not completeness — a `curl --compressed`
fetch (especially backgrounded/parallel) can silently truncate; always confirm the last ~15 bytes
end in `%%EOF` (`tail -c 15 <name>.pdf`) before trusting a download, and if `pypdf` throws "Stream
has ended unexpectedly" on a file `file` called valid, just re-fetch it once (sequentially, not
backgrounded) rather than assuming the source itself is broken.

**If the live URL 404s**, before giving up, check the Wayback Machine's CDX API for a real capture
(older launches especially — pre-2024 URLs get moved/killed during site redesigns):
```bash
curl -s "http://web.archive.org/cdx/search/cdx?url=hdb.gov.sg/-/media/<path-prefix>&matchType=prefix&output=json&limit=50&collapse=urlkey"
```
Look for `"statuscode":"200"` and `"mimetype":"application/pdf"` (a `403`/`301`/`text/html` row is a
dead capture, not real content). Fetch the real one via
`https://web.archive.org/web/<timestamp>id_/<original-url>` (the trailing `id_` returns raw bytes,
not the archive.org wrapper page — add `--compressed` to curl or you'll get gzip binary). Folder
naming has varied by era — `SCEG`, `CCG`, and bare `doc/<date>-Annex/` have all been seen; if the
first guess 404s on both live and Wayback, broaden the CDX `url` prefix (drop the last path segment)
and grep the results for the launch's date stamp. Also don't assume the annex is called "Annex A" —
pre-2016 launches sometimes used "Annex B1" (e.g. Nov 2015) instead, with no fixed rule for which
letter. **A broad CDX search coming up empty is not proof the page was never archived** — it only
proves your filename guesses were wrong. HDB's filename conventions vary wildly (prefix-date vs
suffix-date, `annexA1` vs `annexb1<month><year>btoexercise`, hyphens vs none) and CDX prefix
matching can't find a file whose exact name you haven't guessed. Before declaring a launch
unrecoverable, try a plain web search for terms like `"<launch> BTO" annex pdfdoc site:nas.gov.sg`
or just `hdb.gov.sg annex <launch month year> BTO pdf` — a search engine may surface the exact
official filename (confirmed once already archived, e.g. Nov 2015's `annexb1nov2015btoexercise.pdf`)
that a CDX prefix guess would never have tried; only fall back to housingmap.sg once that's failed.

**Pre-2013 launches used a different hdb.gov.sg site entirely** (Lotus Notes/Domino-based, paths like
`fi10296p.nsf/PressReleases/<32-char-hex-id>?OpenDocument` for the press release and
`fi10297p.nsf/ImageView/<CampaignName>/$file/<Annex>.pdf` for the actual Annex PDF — no clean
`/-/media/` path at all). Broad Wayback CDX search still works but needs a different query shape:
`url=hdb.gov.sg&matchType=domain&from=<launch-date>&to=<launch-date+2weeks>&filter=urlkey:.*(press|annex).*`
finds the press-release HTML pages; the press release page itself then links the real Annex PDF
(`grep -oi 'href="[^"]*"' <page> | grep -i annex`) — fetch that exact archived URL rather than
guessing a PDF filename directly, since these old ImageView paths embed a document ID that can't be
predicted. Confirmed working for Nov 2012 (recovered the genuine Annex A, superseding what looked
like an unrecoverable secondary-source-only launch).

**A secondary source's shared table formatting can look like a project combine when it isn't one.**
singpromos.com (and similar aggregators) sometimes print one price table under a shared heading like
"Rivervale Delta (JPG 420KB) & Compassvale Mast (JPG 480KB)" purely because that's how the original
press release grouped the *photos*, not because the projects share a unit-supply table. Nov 2012 was
initially miscategorized as needing two partial-combine entries based on this heading grouping — the
real Annex A (once found) showed both projects had fully independent, standalone flat-supply tables.
Don't commit to a combined-entry unless the *actual data table* (not just a shared page/photo header)
lacks a per-project split — keep pushing for the primary source before concluding a combine is
necessary.

**Even when the pricing table itself is genuinely shared across two projects, check the Annex's prose
paragraphs before combining** — official Annexes often open with 1-2 paragraphs per project ("Project
X is a standard contract with N flats, comprising...") that give exact independent unit counts even
when the later Table A1 only prints one combined price row per flat type (confirmed: Sep 2011's
Anchorvale Harvest & Fernvale Rivergrove, Waterway Brooks & Waterway Woodcress — prose splits summed
exactly to each combined table row). When this happens, record them as separate standalone project
entries (correct individual coordinates/locations for mapping) rather than one combined entry, using
the shared table's price range for whichever flat types they share — note in the curation note that
prices are the combined-precinct range while units are exact and independently sourced.

**If only ONE project within an otherwise-complete secondary-source table lacks a unit-count
breakdown** (seen twice: Keat Hong Mirage Nov 2012, Clementi Gateway Jul 2012 — singpromos sometimes
prints just a "Typical Selling Price / Household Income / Instalment Ratio" table for one project
instead of the usual Floor Area/Units table), first compute the missing total via reconciliation
(launch headline minus the sum of every other project's known total) to sanity-check any figure you
find, then try **`kendata12345.wordpress.com`**'s per-project BTO cost-analysis posts (category "4.
HDB BTO Flats Price and Cost Analysis") — many embed a rasterized image
(`wp-content/uploads/<yyyy>/<mm>/<yyyy>-<mm>-<town>-<project-slug>.jpg`) showing a per-flat-type
Internal Floor Area/Units/Price breakdown sourced from the real tender/Annex data; `Read` the image
directly (no PDF rendering needed) and cross-check its price ranges against the secondary source's
"From" prices to confirm it's the same project before trusting the unit counts. `btohq.com`'s
`bto-project-spec/<slug>` page usually has the project *total* (useful for the reconciliation
sanity-check) but rarely the per-type split.

**kendata12345.wordpress.com's cost-analysis archive stops at 2010** (confirmed: no 2009 entry, no
pagination on the category page). For 2009 and earlier, fall back to **btohq.com's
`bto-sales-launch/<mon>-<yyyy>-bto` tracker page** (lists every project name + combined unit total
for that launch in its "Project Overview" paragraph) plus each project's own
`bto-project-spec/<slug>` page (per-project total + 'from' prices, no per-type split) — this pattern
held for Dec 2009 (SkyVille/SkyTerrace @ Dawson, Segar Grove, Montreal Dale) and both projects in
this era commonly end up as null-placeholder rows since no per-type split is published anywhere.

**sghousehub.wordpress.com systematically covered every BTO launch circa 2008-2010**, reproducing
the full press release text (exact per-project unit counts and price ranges, not just headline
totals) — confirmed for Oct/Nov 2009. Each post links to the **previous and next post** in its
sidebar (`&laquo; <prev title>` / `<next title> &raquo;`), which is a fast way to walk to an adjacent
month's launch once you've found one post, without a fresh web search each time — check the raw HTML
for `href="[^"]*"` near that prev/next text.

**Wayback capture dates do not correlate with a press release's actual issue date** on the old
hdb.gov.sg fi10296p.nsf domain (confirmed: a June 2008 Straits Vista @ Marsiling press release was
only captured by a crawler in December 2009, eighteen months later). A narrow CDX date window around
the expected launch date can therefore both miss the real press release AND stumble onto a
completely unrelated, much-older one. When date-windowed CDX search comes up empty, a plain web
search for `"HDB is launching" "<project name>"` or `"HDB Launches" "<project name>" BTO` is often
more reliable than further CDX guessing.

**kendata12345.wordpress.com's full launch roadmap back to Jan 2010** (found by fetching
`kendata12345.wordpress.com/category/4-hdb-bto-flats-price-and-cost-analysis/`, which lists every
post in category order, each post naming every project in that launch cluster) — use this instead
of guessing search queries launch-by-launch. **The roadmap has confirmed gaps within 2010 too**
(Feb, Nov, Dec 2010 are all missing from kendata's own list, found only via each recovered press
release's own "next launch" preview sentence) — the full corrected 2010 sequence is: Jan (Limbang
Green + Buangkok Vale) → Feb (Punggol Crest + Treegrove @ Woodlands) → May (Boon Lay Grove + Floral
Spring @ Yishun) → Oct (Senja Parc View + Anchorvale Horizon) → Nov (Yishun Greenwalk) → Dec
(Punggol Topaz) → Jan 2011. **Feb and May 2010's actual press releases were never found** despite
exhaustive Wayback CDX search (unlike every other 2010-2011 gap, which all turned up eventually) —
btohq.com's `bto-sales-launch/<mon>-<yyyy>-bto` tracker page (lists every project name + combined
unit total for a launch) plus each project's own `bto-project-spec/<slug>` page (per-project total +
'from' prices) was the fallback; both projects in each of those two launches ended up with
null-placeholder split rows since no source gives per-type counts.
- 2010: Jan — Limbang Green (Choa Chu Kang), Buangkok Vale (Hougang); May — Boon Lay Grove (Jurong
  West); Oct — Senja Parc View (Bukit Panjang)
- 2011: Jan — Golden Daisy (Bukit Batok); Mar — Boon Lay Fields (Jurong West), Compassvale Ancilla
  (Sengkang) (kendata mislabels this cluster \"Jul 2011\" in its own index — verified via the actual
  press release, issued 24 Mar 2011); Apr — Anchorvale Cove (Sengkang), Hougang Parkview (Hougang),
  Montreal Ville (Sembawang), Waterway Terraces II (Punggol); Sep — Anchorvale Harvest & Fernvale
  Rivergrove (Sengkang), Golden Peony (Jurong West), Teban View (Jurong East), Waterway Brooks &
  Waterway Woodcress (Punggol), Yio Chu Kang Vista (Ang Mo Kio); Nov — Acacia Breeze (Yishun), Golden
  Cassia (Bedok), Hougang Capeview & Hougang DewCourt (Hougang), Waterway Ridges & Waterway Banks
  (Punggol), Fajar Spring (Bukit Panjang)
**Always independently verify kendata's own month label against the actual press release** (search
`HDB launches <headline unit count> BTO <project names>`) before trusting it — confirmed wrong once
(the Mar 2011 cluster). **kendata's roadmap index is also incomplete, not just occasionally
mislabeled** — confirmed missing both Nov 2010 (Yishun Greenwalk) and Dec 2010 entirely, silently
jumping from Oct 2010 straight to Jan 2011. Don't treat it as an authoritative launch list: every
recovered press release ends with an "next BTO launch in <month>: ~N flats in <towns>" preview
sentence — treat THAT as the authoritative pointer to the next-earlier (or next-later, depending on
direction) launch, and verify it exists in your dataset / kendata's index before assuming continuity.
When backfilling and a gap between two already-added launches turns up this way, fill it immediately
out of strict chronological order before continuing further, so gaps don't compound.

**Before reaching for kendata12345's rasterized images, check whether they hosted the real Annex A
PDF instead** — for some launches (confirmed: Jan 2012) their uploads directory has the actual
official PDF, not just per-project tender-cost-analysis images: try
`kendata12345.wordpress.com/wp-content/uploads/2014/07/s<yyyy>-<mm><mon>-launch-<towns>.pdf` (note:
`.../2014/07/...` for this pattern, vs `.../2014/08/...` for the rasterized per-project images) —
search `kendata12345.wordpress.com "<Month> <Year>" annex pdf` or `site:kendata12345.wordpress.com
"<Month> <Year>"` to find the exact filename. When it exists, it's strictly better: exact data for
every project in the launch, no per-project gaps, no reconciliation math needed.

**If a specific project's total is confirmed (by reconciliation + an independent source like
btohq.com) but its per-flat-type split genuinely cannot be found anywhere** (confirmed once: Punggol
Edge, May 2012 — an integrated BTO+rental project that kendata12345's image gallery skipped even
though it covered every other project in the same launch), don't fabricate a split for an *official*
launch either — reuse the same `resale_flat_type: null` / `floor_area_sqm: null` / `price_min: null`
/ `price_max: null` placeholder-row pattern documented below for provisional launches (bto_label
naming the flat types involved, e.g. `"3-Room / 4-Room / 5-Room (split unrecoverable)"`). The
comparison logic already skips null types and the frontend already renders "Price TBD" / "-- sqft"
for null price/area — verified via `/api/bto/project-overview` spot-check, no crash. Document the
exhausted search trail in the launch's `_curation_note` so a future session doesn't re-attempt the
same dead ends.

**Before falling back to a null-placeholder row, try `housingmap.sg/bto/`'s historical brochures —
this is now the PRIMARY fallback, not a last resort.** `https://www.housingmap.sg/bto/` is a single
page listing **every BTO launch back to April 2001** (project name, town, exact launch date, total
units, `info` and `plans` brochure links) — far more complete than kendata12345 (stops at 2010) or
ad-hoc web searches, and it's how all 8 of this backfill's original null-placeholder cases (Punggol
Edge, Ping Yi Greens, Waterway Banks, Fajar Spring, Punggol Crest, Treegrove @ Woodlands, Boon Lay
Grove, Floral Spring @ Yishun) were later upgraded to exact data. Two brochure types per project,
both worth checking:
- **`<Project_Name>_Maps&Plans.pdf`** — has a per-block "Unit Distribution" table (exact units by
  flat type) on an early page (~page 2-3 of the PDF); render with the `Read` tool's `pages` param.
- **`<Project_Name>_General_Info.pdf`** (or a combined `<ProjectA>_<ProjectB>_General_Info.pdf` for
  paired launches) — many 2010+ editions have a full "Indicative Price Range" table with exact floor
  area, units, AND price min/max per flat type, sourced from the real Annex data.
Fetch both via `curl -sL "https://www.housingmap.sg/hdb-brochures/bto-launch-<yyyy>-<mm>/<file>.pdf"`
(URL-encode `@` as `%40`, spaces as `_`; the exact filename is in the `info`/`plans` link on the
index page — don't guess it) and check every page for these tables before concluding no split exists.
Only fall back to the null-placeholder pattern if genuinely neither brochure has a numeric table.

**For launches before Dec 2009 (housingmap.sg has no `info`/`plans` links that far back), try HDB's
own legacy brochure host via Wayback CDX before assuming nothing exists**: `www100.hdb.gov.sg` hosted
per-launch brochure directories at least as far back as 2008, and these ARE captured in the Wayback
Machine even though the live site is long gone. Query
`http://web.archive.org/cdx/search/cdx?url=www100.hdb.gov.sg/&matchType=prefix&from=<yyyy0101>&to=<yyyy1231>&output=json&limit=5000`
and grep the `original` column for `<yy><mon>BTO<town-code>_pdf/` (e.g. `09MARBTOPG` = Mar 2009,
Punggol; `08DECBTOYI` = Dec 2008, Yishun) to find `General_Info.pdf` / `Maps&Plans.pdf` filenames —
same two brochure types and same "Indicative Price Range" table as the housingmap.sg brochures.
**Critical fetch detail**: append the `if_` raw-content modifier to the Wayback timestamp
(`.../web/<timestamp>if_/http://www100.hdb.gov.sg/...`) — without it, Wayback serves an HTML page
with a toolbar injected, which downloads fine (no curl error) but is not a valid PDF (`file` reports
`HTML document`, `pypdf` throws `Invalid object in /Pages`). Always verify with `file <name>.pdf`
after downloading, not just a successful curl exit code, before trusting the file. These brochures
are image-based, same as housingmap.sg's — render with the `Read` tool's `pages` param, not `pypdf`
text extraction.

**If Annex A is genuinely unrecoverable** (checked live URL, checked Wayback CDX broadly, nothing —
confirmed to happen at least once, Nov 2020's Annex A only ever archived as a dead 403), fall back to
`https://www.housingmap.sg/bto/`: it hosts (a) HDB's own sales brochure PDF per project at
`housingmap.sg/hdb-brochures/bto-<yyyy>-<mm>/<Project_Name>.pdf` (spaces→`_`, `@`→`%40`) — no prices,
but each floor-plan page states exact sqm, and the site-plan page (page ~11, varies) has a **per-block
unit-mix table rasterized into the page image** (not extractable via `pypdf` text search — render it
with the `Read` tool's `pages` param, e.g. `pages: "11"`; requires `poppler` — `brew install poppler`
— for page rendering to work at all); and (b) real prices can often be found in a project's dedicated
PropertyGuru **review** article (distinct from the launch's general overview article) — search
`propertyguru.com.sg "<Month> <Year>" BTO review "No. of units"` — check its **FAQ section further
down the page**, not just the opening summary, which sometimes only quotes an *older* launch's prices
as a pre-launch estimate (explicitly labelled "for comparison, here are the prices for the previous
launch..." — don't mistake that for this launch's real data). Reconcile every number against
independently-known project/site totals before trusting it.

## 2. Extract the data

```bash
/Users/weisong/Video/WorthOrNot/venv/bin/python3 -c "
from pypdf import PdfReader
r = PdfReader('<path>.pdf')
for i, p in enumerate(r.pages):
    print(f'===== PAGE {i+1} =====')
    print(p.extract_text())
"
```
(Install pypdf first if missing: `venv/bin/python3 -m pip install --quiet pypdf`.)

**Watch for column misalignment in combined multi-project unit tables.** When one HDB price/unit
table covers two+ projects sharing a header like `2-Room Flexi | 3-Room | 4-Room | 5-Room | 3Gen |
Total`, a project missing an *early* column (e.g. no 2-Room Flexi, but has 3-Room and 4-Room) has
its numbers extracted left-aligned by `pypdf` with no placeholder for the blank cell — so `72 100`
can misleadingly look like `2-Room Flexi=72, 3-Room=100` when it's actually `3-Room=72, 4-Room=100`.
Left-alignment is only safe when the *missing* columns are at the end of the row. Before trusting
any row with fewer populated numbers than the header has columns, sum each column across all
projects in the table and check it against that table's own printed **Total** row — a mismatch means
you've misassigned a column (confirmed to happen for real: May 2017's Woodlands Spring row).

Annex A gives, per project: classification (Standard/Plus/Prime — a section header, not a column),
waiting time, and a table of flat type × floor area × units × price range. It also has a
"COMPARISON OF NEW FLATS AND RESALE COMPARABLES NEARBY" section — that's `hdb_quoted_resale`. The
admin annex's "Submission of Application" paragraph gives `application_start`/`application_end`.

## 3. Resolve each project's town

Must exactly match an existing `transactions.town` value:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('server/db/resale.db', { readonly: true });
console.log(db.prepare(\"SELECT DISTINCT town FROM transactions WHERE town IS NOT NULL ORDER BY town\").all().map(r=>r.town));
"
```
Press releases use neighbourhood names ("Simei", "Chencharu") that don't always match the HDB
*town* — cross-reference this list, or geocode first and check which town's blocks are nearby.

## 4. Geocode each project

Try the **project name itself** first — resolves directly via OneMap for most projects:
```bash
curl -s -G "https://www.onemap.gov.sg/api/common/elastic/search" \
  --data-urlencode "searchVal=<PROJECT NAME>" --data-urlencode "returnGeom=Y" \
  --data-urlencode "getAddrDetails=Y" --data-urlencode "pageNum=1" | python3 -m json.tool
```
Fall back to the location description's street/landmark name only if that returns nothing.

**Don't copy OneMap's `SEARCHVAL`/`BUILDING` spacing verbatim into `project`.** OneMap sometimes
returns compact building names with no spaces around `@` (e.g. `TREETRAIL@WOODLANDS`), but every
existing `@`-named project in the dataset uses `" @ "` with spaces (e.g. `OAK VILLE @ AMK`). A
mismatched key doesn't break geocoding, but it silently breaks `/api/resolve`'s exact-match lookup
for that project — always spot-check `/api/resolve?q=<display name as a user would type it>` for
every new project, not just one or two, and confirm `"resolved": true` before moving on.

Sanity-check against existing blocks in the same town:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('server/db/resale.db', { readonly: true });
const rows = db.prepare(\"SELECT hbc.lat, hbc.lng FROM hdb_block_coords hbc JOIN transactions tx ON tx.block=hbc.block AND tx.street_name=hbc.street_name WHERE tx.town=? LIMIT 5\").all('<TOWN>');
console.log(rows);
"
```
1–2km off is normal for a new estate at a town edge (Bayshore, Tengah, etc.). Multiple km off, or
wrong region of the island, is a red flag — re-check.

## 5. Check for CCA rows

Exclude Community Care Apartment units from `flats[]` — they're not standard BTO flats. Note the
excluded count in a `_curation_note` and reconcile against the press-release total (see step 7).

## 6. Check for a reused project name

HDB sometimes reuses the exact same project name across two launch exercises (confirmed:
"Redhill Peaks", Oct 2025 + Feb 2026 phases of the same estate). Before adding any project, grep
the whole file:
```bash
node -e "
const j = require('./scripts/bto_launches.json');
const seen = {};
for (const l of j.launches) for (const p of l.projects) {
  if (seen[p.project]) console.log('COLLISION:', p.project, 'in', l.launch_id, 'and', seen[p.project]);
  seen[p.project] = l.launch_id;
}
"
```
`project` is a globally unique lookup key (`/api/resolve`, `/api/bto/project-overview` both do
`WHERE UPPER(project) = ?`, no `launch_id` filter) — a collision silently conflates both launches'
data. If found, disambiguate **both** entries (fix the earlier one too) as
`project: "NAME (MONTH YEAR)"` / `display_name: "Name (Month Year)"`, with a one-line note in
`location_desc` on both explaining the split.

## 7. Write and verify before reseeding

Add the launch object to `scripts/bto_launches.json` per `references/schema.md`. Then:
```bash
node -e "
const j = require('./scripts/bto_launches.json');
const l = j.launches.find(x => x.launch_id === '<YYYY-MM>');
let total = 0;
for (const p of l.projects) {
  const u = p.flats.reduce((s,f)=>s+(f.units||0),0);
  total += u;
  const inBounds = p.lat==null || (p.lat>=1.2 && p.lat<=1.5 && p.lng>=103.6 && p.lng<=104.1);
  console.log(p.project, p.town, 'inBounds='+inBounds, 'units='+u);
}
console.log('TOTAL:', total);
"
```
Cross-check `TOTAL` against the press release's headline unit count — it should match exactly
(any gap is usually correctly-excluded CCA units; reconcile explicitly, don't silently absorb it).

Then `npm test` — must stay green with **no test file changes** (seeding is pure data; a broken
test means the data is wrong, not the test).

## 8. Reseed and verify live

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('server/db/resale.db');
db.exec('DROP TABLE IF EXISTS bto_projects');
db.close();
"
# restart the dev server (npm run dev) — it reseeds bto_projects on startup
```
Spot-check:
```bash
curl -s 'http://localhost:3000/api/bto/project-overview?project=<PROJECT NAME>' | python3 -m json.tool
curl -s 'http://localhost:3000/api/resolve?q=<project name>' | python3 -m json.tool
```
Production's nightly refresh rebuilds `resale.db` from scratch and reseeds automatically once the
JSON is committed and deployed — no manual prod step needed.

## 9. Archive per-project reference files

For every project just added, write a human-readable summary to
`bto_launches_info/<launch_id>-<project-slug>.md` (slug = `display_name` lowercased,
non-alphanumerics collapsed to `-`), built straight from the JSON entry (no re-extraction needed):
project/town/classification/location/coordinates/waiting time/application window, a flat-supply
pricing table, an HDB-quoted-resale-comparables table (if present), the `_curation_note` (if
present), and a Sources list mirroring the launch's `sources[]`. This is separate from Step 7's
in-JSON verification — it's a reference copy for the user, generated after the JSON is finalized so
its Sources section reflects the complete `sources[]` array (pricing + admin annex both included).

## Provisional launches (not yet officially announced)

Only add project rows if a third-party BTO-preview tracker gives **firm, unambiguous per-flat-type
unit counts** for that specific project. If a source only gives an aggregate figure covering
multiple sites, do **not** invent a per-type split — add a single aggregate `flats[]` entry with
`resale_flat_type: null` instead (the comparison-table logic already skips null types). Set
`price_min`/`price_max: null` (frontend shows "Price TBD"), `classification: null` if unannounced,
`application_start`/`application_end: null`, and add a `_provisional_note` per project naming the
source (never claim it's official). The frontend's amber "Provisional" banner is driven purely by
`application_start` being null/future — no extra flag needed. **Replace with real data** once
HDB's official Annex A is published, by re-running steps 1–8 above.

## Wrap-up (always)

1. `npm test` green.
2. Update the BTO Dataset summary in `memory-bank/activeContext.md` (counts / one line per launch
   at most — per-launch detail belongs in the launch's `_curation_note`, not the memory bank).
3. For a launch old enough to be past MOP, run `python scripts/fetch_bto_blocks.py` so its
   project pages get the resale section.
4. Do not commit, push, deploy, or bump `?v=` unless the user explicitly asks.
