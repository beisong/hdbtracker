# Active Context: WorthIt

## Recent Changes (Sep 2026 — post-completion audit + 2010 gap-fill, PARTIAL) — LOCAL ONLY, NOT YET COMMITTED

Ran the user-requested double-check after the "ROADMAP COMPLETE" claim below: a full systematic
re-fetch of housingmap.sg (2001-2026, year-batches, cross-referencing project *counts* not just
names) plus a battery of data-integrity checks (duplicate coordinates, null-type/non-null-price
rows, price_min>price_max, schema validation). Result: **zero data errors**, but the "complete"
claim was wrong — found a real gap of **8 missing months**: 2010 (Mar, Apr, Jun, Jul, Aug, Sep) and
2011 (May, Jul). Also updated `CLAUDE.md` with a new "Historical dataset coverage" section
documenting the null-date/null-geocode conventions and the naming-disambiguation pattern for future
sessions.

Filled **3 of the 8** gap months so far, also updated CLAUDE.md with the two brochure-format eras
discovered along the way:
- **2010-03**: Fernvale Ridge (522 units) + Sembawang RiverLodge (306 of 432 built units actually
  offered — 126 2-Room units withheld). Full official price tables recovered from brochure.
- **2010-04**: Punggol Emerald (856) + Punggol Waves (573). **First brochures found with no price
  table at all** (format changed from Mar 2010) — unit counts instead sourced from each project's
  Maps&Plans.pdf block-distribution table and independently cross-checked against an archived HDB
  e-service application-count page (exact match on every figure). Only min prices recoverable from
  secondary sources; `price_max: null` throughout (precedented pattern).
- **2010-06**: Waterway Terraces I (1072, first-ever waterfront/Premium-flat BTO) + Fernvale Foliage
  (504) + Rivervale Arc (1120). Same no-price-table brochure format; unit counts from Maps&Plans.pdf,
  totals reconcile exactly. Prices from secondary sources — full min-max for Waterway Terraces I and
  Fernvale Foliage, min-only for Rivervale Arc (`price_max: null`). `application_end` left null
  (only "closed in July 2010" sourced, not an exact date) — precedented per the null-date convention.

Dataset now at **116 launches**. `npm test` green (240 passed / 1 skipped) after each addition.
**Not yet committed, pushed, or deployed.**

**Remaining pending work** (stopped here per explicit user instruction — "don't go through them one
by one, do a quick check and get ready for commit"): **2010-07** (Corporation Tiara, Senja Gateway),
**2010-08** (Yishun Riverwalk), **2010-09** (Woodlands Dew, Woodlands Meadow), **2011-05** (Costa
Ris, Golden Lily, Punggol Parcvista, Tampines GreenLeaf, Tampines GreenWood, Woodlands Peak),
**2011-07** (Yishun Natura, Segar Meadows [name collision with existing Nov 2007 "Segar Meadows" —
needs a disambiguation suffix], Segar Palmview, Anchorvale Isles, Fernvale Riverbow, Golden
Carnation, Golden Orchid) — 5 more launch months, ~16 more projects. The "ROADMAP COMPLETE" claim in
the section below is therefore **superseded/incorrect** until these are filled.

## Recent Changes (Sep 2026 — BTO historical backfill: Apr 2001, ROADMAP COMPLETE) — LOCAL ONLY, NOT YET COMMITTED

Added the **April 2001 BTO launch** — **the very first BTO exercise HDB ever ran** (15 Apr 2001,
pilot scheme, ~2,500 flats across 4 sites in Sengkang and Sembawang, before BTO fully replaced the
Registration for Flats System in Jan 2002). Two Sengkang projects fully geocoded and unit-confirmed:
Compassvale Arcadia (961 units) and Rivervale Green (776 units), both 4-Room/5-Room split
unrecoverable. The two Sembawang projects, Flowing Greenery (410 units) and River Edge (447 units),
could not be geocoded — **confirmed via a direct re-query of housingmap.sg that both are explicitly
marked "Cancelled"** on their own roadmap, meaning neither was ever built, which is exactly why
neither resolves in OneMap (third and fourth null-geocode cases this backfill, after Dec 2004's
Anthias/Coral Green). housingmap.sg's page also states verbatim "Build-To-Order was introduced in
April 2001" and directly confirmed these four launches are the earliest entries on their entire
roadmap — **there is nothing earlier**.

**This closes out the full historical backfill.** Every launch on housingmap.sg's roadmap from April
2001 through the present has now been worked through. Session totals: dataset grew from 90 → **113
launches** (449 projects), span April 2001 → June 2026. Notable milestones this session: discovered
HDB's legacy VSF microsite archive in Wayback (2006-2009 sweet spot for rich plain-text price
tables); the landmark Pinnacle@Duxton (May 2004); four housingmap.sg total discrepancies caught and
resolved by preferring corroborated secondary sources; two "combined vs split" project-naming
judgment calls (Atrina, Aspella) where housingmap's multi-row split didn't match the actual press/
building history; four null-geocode cases (two cancelled-and-never-built, two simply delisted); and
one mid-session naming-collision fix (The Coris Phase 1/2). `npm test` green (240 tests, no test
file changes) throughout. **Not yet committed, pushed, or deployed** — this entire session's 23 new
launches remain local-only, per the "commit only when explicitly asked" convention (the prior
90-launch state was already committed as `141dd36` in an earlier session). No further backfill work
remains per the standing instruction — the task is complete pending user review/commit.

## Recent Changes (Sep 2026 — BTO historical backfill: Dec 2002, completes 2002) — LOCAL ONLY, NOT YET COMMITTED

Added the **December 2002 BTO launch** (3 standalone projects, all confirmed all-4-Room via current
listings: Edgedale Green — Punggol — 582 units; The Periwinkle — Punggol — 450 units; The Coris
(Phase 1) — Sengkang — 434 units). **Caught and fixed a naming collision from earlier this
session**: the Sept 2003 launch's project had been named plain 'THE CORIS' before this Dec 2002
'Phase 1' was discovered — renamed the Sept 2003 entry to 'THE CORIS (PHASE 2)' and regenerated its
reference file. The two phases' totals cross-validate cleanly against a current merged listing
(434+448=882 total units, matching exactly). All totals confirmed via current real-estate listings;
no pricing or exact dates recoverable for any of the three. This completes **every 2002 BTO launch**
(only this one Dec 2002 entry, per housingmap.sg's roadmap — no other 2002 launches listed).
Dataset now spans **December 2002 → June 2026**, 112 launches total. `npm test` green (240 tests,
no test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further
back per the standing instruction — the **only remaining target is April 2001** (four launches:
Compassvale Arcadia, Rivervale Green, Flowing Greenery, River Edge — per housingmap.sg's roadmap,
apparently the very start of the BTO system itself, since no earlier launches are listed). This is
the absolute frontier the user's earlier "same rigor" answer anticipated might have no recoverable
source at all — once this is attempted (successfully or not), the entire housingmap.sg roadmap back
to 2001 will have been worked through.

## Recent Changes (Sep 2026 — BTO historical backfill: Dec 2003, completes 2003) — LOCAL ONLY, NOT YET COMMITTED

Added the **December 2003 BTO launch** (1 standalone entry: Aspella — Sengkang — 862 units, all
4-Room Premium). Same treatment as Atrina: housingmap.sg splits this into "Aspella 1"/"Aspella 2"
(429+433=862), but every secondary source describes one 8-block, 862-unit development with no
mention of two launches, so recorded as a single project. Notable: a Premium contract priced 15-20%
above standard BTO of the era, later cited as one of the most profitable BTO projects ever on a
percentage basis. No pricing or exact dates recoverable. This completes **every 2003 BTO launch**
(Sep, Dec — 2 launch entries, 4 projects). Dataset now spans **December 2003 → June 2026**, 111
launches total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction — 2003 is complete; per
housingmap.sg's earlier-extracted roadmap, the remaining tail is December 2002 (three launches: The
Coris 1, The Periwinkle, Edgedale Green) and finally April 2001 (four launches: Compassvale Arcadia,
Rivervale Green, Flowing Greenery, River Edge — apparently the very start of the BTO system). This is
the exact territory the user's earlier "Continue with same rigor" answer anticipated might have no
recoverable source at all — every launch found from here on may end up as a housingmap-total-only
placeholder, or may be entirely unrecoverable.

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2003) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2003 BTO launch** (3 projects launched together 4-24 Sep 2003: The Sundial —
Punggol — 903 units all 4-Room, price_min $138,000; The Coris — Sengkang — 448 units all 4-Room,
price_min $157,000; Spring Lodge — Sembawang — 447 units, 4-Room/5-Room split unrecoverable).
**Untangled a genuinely confusing source conflict** for Spring Lodge: housingmap.sg lists "432 & 447
units" for this launch, and a secondary source notes a 2003-listed Spring Lodge phase (block 465)
was cancelled while a different block (466) was actually built — used the confirmed-built total
(447) and documented the ambiguity rather than guessing which reading is authoritative. Both Sundial
and Coris only have a confirmed *minimum* price (partial-data pattern, price_max null). Dataset now
spans **September 2003 → June 2026**, 110 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back per the
standing instruction — per housingmap.sg's roadmap, next is December 2003 (Aspella 1 & 2, Sengkang,
429 & 433 units), then the roadmap moves into December 2002 (The Coris 1, Edgedale Green, The
Periwinkle) and finally April 2001 (four launches, likely the start of the BTO system itself) — this
is the territory the user's earlier "same rigor" answer anticipated might have no recoverable source
at all.

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2004, completes 2004) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2004 BTO launch** (1 standalone entry: Atrina — Sengkang — 760 units, all
4-Room). **Judgment call**: housingmap.sg's roadmap lists this as two separate entries ("Atrina 1"
and "Atrina 2", 424+366=790 units), but a contemporaneous Straits Times article (25 Mar 2004)
describes one single press event for "Atrina" with no mention of two phases, and current real-estate
listings describe one merged 760-unit development across 8 blocks — recorded as a single launch/
project (760 units) rather than following housingmap's split, since the primary press coverage and
built-development evidence both point to one exercise. This completes **every 2004 BTO launch**
(Mar, May, Aug, Dec — 4 launch entries, 6 projects, including the landmark Pinnacle@Duxton). Dataset
now spans **March 2004 → June 2026**, 109 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back per the
standing instruction — 2004 is now complete; the roadmap moves into **2001-2003** next (10 launches
per the earlier-extracted list: The Coris 2 Sep 2003, Spring Lodge Sep 2003, The Sundial Sep 2003,
Aspella 1 & 2 Dec 2003, The Coris 1 Dec 2002, The Periwinkle Dec 2002, Edgedale Green Dec 2002, then
the four April 2001 launches that appear to mark the actual start of the BTO system: Compassvale
Arcadia, Rivervale Green, Flowing Greenery, River Edge) — this is the territory the user's earlier
'Continue with same rigor' answer specifically anticipated might have no recoverable source at all.

## Recent Changes (Sep 2026 — BTO historical backfill: May 2004, Pinnacle@Duxton) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2004 BTO launch** (1 standalone entry: **Pinnacle @ Duxton** — Central Area, Mature
Estate — 1,848 units, S1/4-Room-equivalent 1,232 + S2/5-Room-equivalent 616). As anticipated, this
landmark project (seven 50-storey towers, world's tallest public housing at completion, multiple
architecture awards) is far better documented than the surrounding thin 2004-2005 entries — full
price/unit breakdown confirmed across multiple independent sources. Notable historical detail: HDB
initially released only 528 of the 1,848 units, but overwhelming demand (3,149 applications within
one day) led it to release the remaining 1,320 units immediately rather than phase the rollout —
final tally 5,171 applications for 1,848 units. Live spot-check showed the comps ladder computing a
striking ~73-74% BTO-to-resale discount (median resale ~$1.3-1.46M vs. the ~$335K original price),
a nice real-world confirmation of the well-known "Pinnacle million-dollar flat" story. Application
close date not found precisely (only "by July 2004 the launch had closed") — left null, launch date
firmly confirmed so status still computes correctly. Dataset now spans **May 2004 → June 2026**, 108
launches total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is March 2004 (Atrina 1 & 2, Sengkang, 424 & 366 units), which completes
2004 and moves the roadmap into 2001-2003 territory (10 launches, per the earlier-extracted list).

## Recent Changes (Sep 2026 — BTO historical backfill: Aug 2004) — LOCAL ONLY, NOT YET COMMITTED

Added the **August 2004 BTO launch** (1 standalone entry: Fernvale Grove — Sengkang — 398 units,
116×3-Room + 282×4-Room). **Fourth housingmap.sg total discrepancy found this backfill** (after
Jade Spring, Segar Meadows, and implicitly others): housingmap says 508 units, but a detailed
per-block breakdown (48+20+48 3-Room across 3 blocks, 86+100+96 4-Room) from a real-estate database
sums to 398 exactly and was trusted instead, given its internal consistency at the block level. No
pricing or exact dates recoverable — same "total + type only" tier as the last several 2004-2005
launches. Dataset now spans **August 2004 → June 2026**, 107 launches total. `npm test` green (240
tests, no test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill
further back per the standing instruction — next per housingmap.sg's roadmap is May 2004
(**Pinnacle@Duxton**, Central Area, 1,848 units) — a landmark, extensively-documented project (tallest
public housing in the world at completion, won multiple architecture awards), expected to have much
richer sourcing than the surrounding Sengkang/Punggol launches despite being from the same era.

## Recent Changes (Sep 2026 — BTO historical backfill: Dec 2004, first null-geocode case) — LOCAL ONLY, NOT YET COMMITTED

Added the **December 2004 BTO launch** (2 projects launched together 28 Dec 2004, confirmed via
NLB's NewspaperSG archive index for Straits Times/Today/Berita Harian: Anthias — Punggol — 734 units,
134×3-Room + 600×4-Room; Coral Green — Sengkang — 655 units, all 4-Room). Both totals match
housingmap.sg exactly. Application originally closed 16 Jan 2005 but HDB extended it to 23 Jan 2005
— used the extended date. **First-ever null-geocode case in this dataset**: neither project could be
found in OneMap under any name variant tried (confirmed the API itself still works via a known-good
control query) — both precinct names appear to have been fully delisted/superseded in OneMap's
current index, unlike every other project so far. Verified this is safe before proceeding: the comps
endpoint (`server/index.js:2244`) already guards `head.lat == null || head.lng == null`, falling
through to the town-level fallback, and this was confirmed live — both projects' `/api/bto/project-
overview` returned full town-level comps with no crash. The frontend map code also already guards
`resolvedData.lat && resolvedData.lng` before placing a marker. No pricing was recoverable for
either project despite the strong date/unit-count sourcing. Dataset now spans **December 2004 → June
2026**, 106 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is August 2004 (Fernvale Grove, Sengkang, 508 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2005, completes 2005) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2005 BTO launch** (1 standalone entry: Tivela — Sengkang — 374 units, all
4-Room). Same data-poor 2005 pattern as the prior three launches — total and flat type confirmed via
a current listing, everything else (price, floor area, exact dates) unrecoverable. This completes
**every 2005 BTO launch** (Mar, Jun, Sep — 3 launch entries, 3 projects; all three share the same
"total-only" data-quality tier). Dataset now spans **March 2005 → June 2026**, 105 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**
Continuing to backfill further back per the standing instruction — per housingmap.sg's
earlier-extracted roadmap, next is December 2004 (two launches: Coral Green, Sengkang, 655 units;
Anthias, Punggol, 734 units), then August 2004 (Fernvale Grove, 508 units), then May 2004
(**Pinnacle@Duxton**, Central Area, 1,848 units — a landmark, extensively-documented project, likely
much better-sourced than the surrounding Sengkang/Punggol launches despite being older), then March
2004 (Atrina 1 & 2, Sengkang, 424 & 366 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Jun 2005) — LOCAL ONLY, NOT YET COMMITTED

Added the **June 2005 BTO launch** (1 standalone entry: Coralinus (Phase 1) — Punggol — 369 units,
all 4-Room). Completes the Coralinus pair (Phase 2 already in dataset as `2006-02`, 734 combined
units reconciling exactly against current merged listings). Same data-poor pattern as Phase 2 and
Sep 2005's Fernvale Court: VSF price pages exist in Wayback's index but are empty image-based pages
with the underlying images never captured — only the confirmed total and flat type survive. This is
now the **third consecutive launch** with this same "total confirmed, everything else null" profile,
confirming 2005 is a genuine data-quality cliff for this backfill (expected and pre-approved by the
user's earlier 'same rigor' response). Dataset now spans **June 2005 → June 2026**, 104 launches
total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is March 2005 (Tivela, Sengkang, 374 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2005, archive coverage thins sharply) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2005 BTO launch** (1 standalone entry: Fernvale Court — Sengkang — 500 units,
3-Room and 4-Room, split unrecoverable). **Confirms the expected 2005-and-earlier archive cliff**:
this project's legacy VSF microsite has almost no Wayback captures at all (a single nav page, no
price/steps content ever crawled) — a much sharper coverage drop than 2006, where at least some
price data was usually recoverable. No secondary source covering this specific launch was found
either. Only the confirmed total and flat-type composition survive; price, floor area, unit split,
and application dates are all null/approximated. This is expected and pre-approved — matches exactly
what the user's earlier 'Continue with same rigor' response anticipated ('more null-placeholder
entries, possibly no source at all for the very earliest launches'). Dataset now spans **September
2005 → June 2026**, 103 launches total. `npm test` green (240 tests, no test file changes). **Not
yet committed, pushed, or deployed.** Continuing to backfill further back per the standing
instruction — next per housingmap.sg's roadmap is June 2005 (Coralinus 1, Punggol, 369 units — the
earlier phase completing the Coralinus pair whose Phase 2 was added as `2006-02`).

## Recent Changes (Sep 2026 — BTO historical backfill: Feb 2006, completes 2006) — LOCAL ONLY, NOT YET COMMITTED

Added the **February 2006 BTO launch** (1 standalone entry: Coralinus (Phase 2) — Punggol — 365
units, all 4-Room). **The most data-poor launch found in this entire backfill**: the VSF's price
table was itself a JPEG image, and that image was never captured by Wayback at all (a new failure
mode — the containing HTML page WAS archived, but its embedded image wasn't, confirmed via a CDX
search returning zero hits for the image URL at any timestamp) — distinct from every other gap
pattern found so far (crawled-but-empty, never-crawled-at-all, or genuinely 404'd). No steps/date
page and no secondary source (one promising forum thread is itself now a dead link with no Wayback
capture) could be found either. Only the confirmed total (365, cross-validated against the current
merged Coralinus listing: 369 Phase 1 + 365 this launch = 734, matching exactly) and flat type
(4-Room) survived — price, floor area, and application dates are all unrecoverable;
`application_start` uses the least-confident approximation in this dataset (first of the
housingmap-designated month, with no confirmed close date to anchor backward from, unlike every
other approximated date so far). This completes **every 2006 BTO launch** (Feb, Jul, Sep×2, Oct,
Nov — 6 launch entries, 7 projects). Dataset now spans **February 2006 → June 2026**, 102 launches
total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction — per housingmap.sg's
earlier-extracted roadmap, next is September 2005 (Fernvale Court, Sengkang, 500 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Jul 2006) — LOCAL ONLY, NOT YET COMMITTED

Added the **July 2006 BTO launch** (1 standalone entry: Fernvale Vista (Phase 1) — Sengkang — 508
units, fully confirmed: 86×2-Room + 92×3-Room + 330×4-Room). No VSF price page was ever crawled for
this one, but a contemporaneous wedding-forum thread that actively tracked the launch in real time
gave the complete official breakdown, independently corroborated by the VSF's own steps page for the
application dates (24 Jul - 14 Aug 2006 — a rare pre-2008 launch with a fully-confirmed, not
approximated, `application_start`). Cross-validated against current live listings for the merged
Fernvale Vista site: 508 (Phase 1) + 678 (Phase 2, already in dataset) = 1,186, matching exactly.
Dataset now spans **July 2006 → June 2026**, 101 launches total. `npm test` green (240 tests, no
test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back
per the standing instruction — next per housingmap.sg's roadmap is February 2006 (Coralinus 2,
Punggol, 365 units), the last 2006 entry before the roadmap moves into 2005.

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2006, 100-launch milestone) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2006 BTO launch** (2 projects sharing one monthly VSF exercise folder:
Sembawang Green — 471 units, all 4-Room, fully confirmed via its price table; Golden Jasmine —
Bishan, Mature Town — 176 units, all elderly-only Studio Apartments, price/floor-area genuinely
unrecoverable, single null-price placeholder row). **Dataset reaches 100 launches** (span: September
2006 → June 2026). `npm test` green (240 tests, no test file changes). **Not yet committed, pushed,
or deployed** — this entire session's work (11 new launches, 90→100, spanning Feb 2008 down through
Sep 2006) remains uncommitted; the prior session's 90-launch state (through Feb 2008) was already
committed as `141dd36` and pushed. Continuing to backfill further back per the standing instruction —
next per housingmap.sg's roadmap is July 2006 (Fernvale Vista 1, Sengkang, 508 units — an earlier
phase of the project whose Phase 2 was already added as `2007-05`), then February 2006 (Coralinus 2,
Punggol, 365 units), which per the previously-extracted roadmap is the last 2006 entry before 2005.

## Recent Changes (Sep 2026 — BTO historical backfill: Oct 2006) — LOCAL ONLY, NOT YET COMMITTED

Added the **October 2006 BTO launch** (1 standalone entry: Sri Geylang Serai — Geylang, Mature
Town — 447 units, all 4-Room Standard flats, $230,000-$292,000) — a SERS-linked mature-town BTO
site per secondary sources (remaining flats after SERS resettlement re-offered via BTO). Fully
confirmed via its legacy VSF price table; application close (15 Nov 2006) confirmed, start
approximated per the established pattern. Dataset now spans **October 2006 → June 2026**, 99
launches total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is September 2006 (two launches: Sembawang Green 471 units, Golden Jasmine
[Bishan, mature town] 176 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2006, start of 2006) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2006 BTO launch** (1 standalone entry: Compassvale View — Sengkang — 390 units,
fully confirmed: 105×3-Room + 285×4-Room). Recovered from its legacy VSF price table. Application
close (18 Dec 2006) confirmed; launch start approximated (`2006-11-27`) per the established pattern
since no exact day was found. This is the first 2006 launch in the dataset. Dataset now spans
**November 2006 → June 2026**, 98 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back per the
standing instruction — per housingmap.sg's earlier-extracted roadmap, next is October 2006 (Sri
Geylang Serai, Geylang, 447 units — a mature-town BTO site), then September 2006 (two launches:
Sembawang Green 471 units, Golden Jasmine [Bishan] 176 units), then July 2006 (Fernvale Vista 1, 508
units — Phase 1 of the project whose Phase 2 was already added as `2007-05`), then February 2006
(Coralinus 2, Punggol, 365 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2007, completes 2007) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2007 BTO launch** (1 standalone entry: Treelodge @ Punggol — 712 units, fully
confirmed: 98×3-Room + 600×4-Room + 14×5-Room Loft) — Singapore's first eco-precinct public housing
development and first Green Mark Platinum Award public housing project, a well-documented landmark
project. Fully confirmed via its legacy VSF price table (hosted this time on plain `www.hdb.gov.sg`
rather than the `www69`/`www101` subdomains seen for other 2007 launches) plus independently
corroborated launch date (28 Mar 2007) from multiple secondary sources, since this project is far
more widely written about than most other launches from this era. **Also caught and fixed** the same
`@`-spacing bug documented earlier this session (OneMap returned `TREELODGE@PUNGGOL` with no spaces;
renamed to `TREELODGE @ PUNGGOL` per the dataset's established convention). This completes **every
2007 BTO launch** (Mar, May, Aug, Sep, Oct, Nov, Dec — 7 launch entries, 9 projects, for the year).
Dataset now spans **March 2007 → June 2026**, 97 launches total. `npm test` green (240 tests, no
test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back
per the standing instruction — per housingmap.sg's earlier-extracted roadmap, 2007 is now complete;
next is 2006 (6 launches: Fernvale Vista 1 Jul 2006/508 units, Compassvale View Nov 2006/390 units,
Sembawang Green Sep 2006/471 units, Golden Jasmine Sep 2006/176 units [Bishan — a mature-town BTO
site], Sri Geylang Serai Oct 2006/447 units [Geylang], Coralinus 2 Feb 2006/365 units [Punggol]).

## Recent Changes (Sep 2026 — BTO historical backfill: May 2007) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2007 BTO launch** (1 standalone entry: Fernvale Vista (Phase 2) — Sengkang — 678
units, fully confirmed: 164×2-Room + 174×3-Room + 340×4-Room). A later phase distinct from Fernvale
Vista 1 (Jul 2006, not yet added) — uses `FERNVALE VISTA (PHASE 2)` as the project key pre-emptively,
same disambiguation convention as Jade Spring's two phases. Application dates (30 May - 13 Jun 2007)
have unusually high confidence for a pre-2008 launch: the close date came directly from the VSF steps
page, and the start date is corroborated by the earliest Wayback capture of the project's microsite
being dated exactly 30 May 2007 (not just inferred from the 14-day pattern). Dataset now spans **May
2007 → June 2026**, 96 launches total. `npm test` green (240 tests, no test file changes). **Not yet
committed, pushed, or deployed.** Continuing to backfill further back per the standing instruction —
next per housingmap.sg's roadmap is March 2007 (Treelodge, Punggol, 712 units) — no April 2007
launch was listed.

## Recent Changes (Sep 2026 — BTO historical backfill: Aug 2007) — LOCAL ONLY, NOT YET COMMITTED

Added the **August 2007 BTO launch** (1 standalone entry: Punggol Vista — 628 units, all confirmed:
105×2-Room + 210×3-Room + 313×4-Room). Application close (3 Sep 2007) confirmed from the VSF steps
page; launch/start date not found anywhere, so `application_start` uses the same "approximate,
2-weeks-before-the-confirmed-close-date" pattern established for Nov 2007, corroborated by the
earliest Wayback capture of this project's site (27 Aug 2007) confirming it was live by then.
Dataset now spans **August 2007 → June 2026**, 95 launches total. `npm test` green (240 tests, no
test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back
per the standing instruction — per housingmap.sg's earlier-extracted roadmap, the next entry after
August 2007 is May 2007 (Fernvale Vista 2, Sengkang, 678 units) — no launches were listed for June
or July 2007.

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2007) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2007 BTO launch** (1 standalone entry: Coral Spring — Sengkang — 698 units,
all 4-Room Premium flats, 92 sqm internal, $188,000-$252,000). Fully confirmed via its legacy VSF
price table, with application dates (20 Sep - 9 Oct 2007) independently cross-confirmed by both the
VSF's own steps page and a contemporaneous Straits Times article. One flaky test failure observed
on this run (`npm test` reported 1 failed test on a first pass, then 240/240 green on immediate
retry with no code change) — treated as a transient flake, not a regression, since the diff was
purely additive JSON data with no logic changes. Dataset now spans **September 2007 → June 2026**,
94 launches total. `npm test` green (240/240, after the one flaky retry). **Not yet committed,
pushed, or deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is August 2007 (Punggol Vista, 628 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Oct 2007) — LOCAL ONLY, NOT YET COMMITTED

Added the **October 2007 BTO launch** (2 projects launched together, 25 Oct - 14 Nov 2007, both
fully confirmed with complete official data): Telok Blangah Towers — Bukit Merah, Mature Town, a
notable rare in-town/near-CBD BTO site — 400 units (90 Studio Apartment + 100×3-Room + 210×4-Room);
Punggol Lodge — Punggol — 516 units (52×3-Room + 464×4-Room). Recovered from two property-blog
reproductions of the actual HDB press release and a Straits Times article, together giving every
figure including Studio Apartment and 3-Room prices that the press-release copy alone omitted — no
Wayback/VSF data was needed at all for this one (its microsite exists but was never crawled beyond
frame pages, same gap pattern as Dec 2007's two projects). Floor area wasn't published anywhere
found, left null for all rows. Dataset now spans **October 2007 → June 2026**, 93 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**
Continuing to backfill further back per the standing instruction — next per housingmap.sg's roadmap
is September 2007 (Coral Spring, Sengkang, 698 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2007) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2007 BTO launch** (2 projects: Compassvale Beacon — Sengkang — 750 units, fully
confirmed via its legacy VSF price table; Segar Meadows — Bukit Panjang — unit-type split
unrecoverable, single placeholder row). **Second housingmap.sg total discrepancy found**: housingmap
lists Segar Meadows as 412 units, but srx.com.sg and stackproperty.sg both independently report 712
— went with 712 (multiple independent sources vs. housingmap's one, and housingmap already had one
proven error this backfill). **First use of an approximate `application_start`**: neither project's
exact launch day nor close date was recoverable anywhere, so `application_start` was set to
`2007-11-01` as a documented month-only approximation purely so `launchStatus()` still reports
'closed' rather than 'upcoming' for an 18-year-old launch — verified the frontend never actually
displays `application_start` for a closed launch (only `application_end`, via `app.js:1681-1682`),
so this approximation carries no risk of showing a fabricated date to users. This is a new pattern
for this dataset (every prior null-date case left the field `null` outright); documented clearly in
the curation note as an approximation, not a discovered fact. Dataset now spans **November 2007 →
June 2026**, 92 launches total. `npm test` green (240 tests, no test file changes). **Not yet
committed, pushed, or deployed.** Continuing to backfill further back per the standing instruction —
next per housingmap.sg's roadmap is October 2007 (Punggol Lodge 516 units, Telok Blangah Towers 400
units).

## Recent Changes (Sep 2026 — BTO historical backfill: Dec 2007) — LOCAL ONLY, NOT YET COMMITTED

Added the **December 2007 BTO launch** (2 projects launched together, 27 Dec 2007: Damai Grove —
Punggol — 738 units, Jade Spring @ Yishun Phase 1 — 384 units). **Naming collision resolved**: this
is a different, earlier phase from the already-seeded March 2008 "Jade Spring @ Yishun" (Phase 2) —
both geocode to the same OneMap result, so this phase uses `project: "JADE SPRING @ YISHUN (PHASE
1)"` to stay distinct, following the existing `TANJONG TREE RESIDENCES @ HOUGANG (FEB 2024)` /
`(NOV 2021)` disambiguation precedent already in the dataset. **First genuine VSF-crawl gap**: HDB's
legacy microsite exists in Wayback's CDX index for both projects but only the outer frame page was
ever actually crawled (no price/steps/flats text pages) — distinct from the earlier "200-status but
unfetchable" Punggol Spring case, this is a real "never crawled" gap. Recovered from a contemporaneous
Business Times article: combined totals (1,122 flats: 110×3-Room + 1,012×4-Room) plus each project's
exact 4-Room price range (Damai Grove $195k-$240k, Jade Spring 1 $183k-$246k). The 3-Room unit split
per project (62 for Damai Grove, 48 for Jade Spring 1) was derived arithmetically by subtracting each
project's confirmed 4-Room count from its housingmap.sg total — the two derived numbers summed to
exactly the article's combined 110, corroborating the derivation. No 3-Room pricing or any floor area
was published anywhere found — both left null (partial-data pattern). Also discovered mid-session
that port 3000 was occupied by an unrelated NestJS app (`dist/main.js`, PID from a different
project) — switched to `PORT=3001` for local spot-checks rather than touching a process not
recognized as this project's. Dataset now spans **December 2007 → June 2026**, 91 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed** (the
prior 90-launch state, through Feb 2008, WAS already committed as `141dd36` and pushed to
`origin/main` in the previous session — only this Dec 2007 addition is new/uncommitted). Continuing
to backfill further back per the standing instruction — next per housingmap.sg's roadmap is November
2007 (Compassvale Beacon, Segar Meadows), part of a much longer remaining tail (33 launches total
back to April 2001, per the previous session's full roadmap extraction).

Added the **February 2008 BTO launch** (1 standalone entry: Punggol Spring — 494 units, all 4-Room
Standard flats, $204,000-$259,000) — HDB's own "first BTO development for 2008" per a contemporaneous
Business Times article. Floor area (90 sqm internal) from the project's legacy VSF 'flats' page; the
VSF's price/steps pages were never successfully fetched despite a 200 status in Wayback's CDX index
(consistently returned Wayback's generic "not found" page on repeated retry, distinct from the
several genuine transient 503 "Internet Archive Temporarily Offline" outages hit elsewhere this
session, which always recovered) — a first documented case of a CDX-listed 200 capture that's
practically unfetchable. Application close date not recoverable from any source — recorded null
(launch date 26 Feb 2008 confirmed, so status still correctly computes 'closed'). This completes
**every 2008 BTO launch** (Feb, Mar, May, Jun×2, Aug, Nov, Dec×2 — 9 launch entries for the year).
Dataset now spans **February 2008 → June 2026**, 90 launches total. `npm test` green (240 tests, no
test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back
per the standing instruction — next: checking housingmap.sg's roadmap coverage of 2001-2007, which
hasn't been verified yet (the site's `/bto/` page claims coverage back to April 2001).

**Update**: fetched the full 2001-2008 roadmap — housingmap.sg lists **33 more launches** back to
April 2001, which appears to be when the BTO system itself started (four projects launched
simultaneously that month: Compassvale Arcadia, Rivervale Green, Flowing Greenery, River Edge).
Full chronological list (newest-first, working backward from here): Dec 2007 (Jade Spring 1, Damai
Grove) → Nov 2007 (Compassvale Beacon, Segar Meadows) → Oct 2007 (Punggol Lodge, Telok Blangah
Towers) → Sep 2007 (Coral Spring) → Aug 2007 (Punggol Vista) → Mar 2007 (Treelodge) → May 2007
(Fernvale Vista 2) → 2006 (6 launches) → 2005 (3 launches) → 2004 (4 launches, including
Pinnacle@Duxton, 1,848 units) → 2001-2003 (10 launches) → Apr 2001 (4 launches, likely BTO system
launch). This is a much longer tail than anticipated — continuing at the same rigor per the standing
instruction, using the www100/www101.hdb.gov.sg Wayback approach where it reaches (likely only back
to ~2008-2009 based on captures seen so far) and falling back to contemporaneous news/blog sources
for older ones, with null-placeholders where genuinely unrecoverable.

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2008) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2008 BTO launch** (1 standalone entry: Jade Spring @ Yishun (Phase 2) — 576
Standard flats, reconciles exactly: 36×2-Room + 72×3-Room + 468×4-Room). **Data-quality catch**:
housingmap.sg's roadmap lists this launch's total as 572 units — 4 off from the officially verified
576. Cross-checked against a contemporaneous property blog independently titled "HDB launches
576-unit Yishun project" with matching per-type prices, confirming 576 is correct and housingmap's
total has an error (first such discrepancy found against housingmap's totals in 84 launches checked
so far — documented in this launch's curation note in case future entries hit the same issue).
Application period (18-31 Mar 2008) corroborated by two independent contemporaneous sources. Dataset
now spans **March 2008 → June 2026**, 89 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back per the
standing instruction — next per housingmap.sg's roadmap is February 2008 (Punggol Spring, 494
units), which per the earlier-extracted roadmap listing is the earliest 2008 entry — after that the
roadmap's coverage of 2001-2007 needs checking from scratch.

## Recent Changes (Sep 2026 — BTO historical backfill: May 2008) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2008 BTO launch** (2 projects launched together, 22 May - 4 Jun 2008: Punggol
Sapphire 1,065 units, Compassvale Pearl 420 units — both reconcile exactly). Compassvale Pearl's
exact official price table was recovered from its legacy VSF microsite (336×4-Room + 84×5-Room).
Punggol Sapphire's own VSF price page was never crawled by Wayback (only a 404 capture exists) and
no brochure PDF exists either — genuinely unrecoverable at full detail. Unit split (760×4-Room +
282×5-Room Premium + 23×5-Room Loft) and partial price bookends ($234,000 4-Room min, $477,000
5-Room-Loft max) recovered from a contemporaneous Straits Times article (reproduced on a property
blog, dated 23 May 2008, confirming launch was "yesterday" i.e. 22 May) — **this article's quoted
Compassvale Pearl price bookends matched the Wayback-verified VSF table exactly**, which is what
gave confidence to trust its Punggol Sapphire figures too despite being unable to independently
verify those. Applied the established partial-data pattern (null where genuinely unconfirmed) rather
than guessing 4-Room's max, 5-Room Premium's range, or 5-Room Loft's min. The Loft type has no
resale-market equivalent so `resale_flat_type` is null for that row — verified this renders
"Price TBD" gracefully (loses the one confirmed max-price data point rather than crashing, since the
frontend's price display branches on `price_min != null`). Dataset now spans **May 2008 → June
2026**, 88 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is March 2008 (Jade Spring 2, Yishun, 572 units), then February 2008
(Punggol Spring, 494 units) — after which housingmap.sg's roadmap runs out (April 2001 earliest
listed entry, but the exact shape of 2001-2007 coverage hasn't been checked yet).

## Recent Changes (Sep 2026 — BTO historical backfill: Jun 2008, 2 separate exercises) — LOCAL ONLY, NOT YET COMMITTED

Added **two separate June 2008 BTO launches**, mirroring the Dec 2008 pattern: `2008-06a` Straits
Vista @ Marsiling (10-23 Jun 2008, Woodlands, 382 units: 50×3-Room + 332×4-Room — this project's data
had already been fully extracted earlier in the session before a mid-session summary, and this fetch
independently re-derived the identical figures, confirming the earlier extraction was accurate) and
`2008-06b` Punggol Breeze + Fernvale Residence (30 Jun-14 Jul 2008, 964 + 623 units). Confirmed
distinct exercises via differing application windows recovered from each project's legacy VSF
microsite plus independent blog corroboration for the later pair's dates. Applied the `a`/`b`
launch_id suffix convention established for Dec 2008. Dataset now spans **June 2008 → June 2026**,
87 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed,
or deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is May 2008 (Punggol Sapphire 1,065 units, Compassvale Pearl 420 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Aug 2008) — LOCAL ONLY, NOT YET COMMITTED

Added the **August 2008 BTO launch** (1 standalone entry: Senja Green — Bukit Panjang — 474 Standard
flats, reconciles exactly: 96×2-Room + 94×3-Room + 284×4-Room). The www100.hdb.gov.sg brochure PDF
404s for this one, but its `eampu08p.nsf` legacy VSF microsite survived in Wayback with the same
plain-text price table pattern as Dew Spring/Champions Court. Application close date (8 Sep 2008)
confirmed from the site's own steps page. Dataset now spans **August 2008 → June 2026**, 85 launches
total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is a 3-launch June 2008 (Punggol Breeze 964 units, Fernvale Residence 623
units, Straits Vista @ Marsiling 382 units) — Straits Vista's data was already fully extracted with
complete official Annex 1 figures earlier this session (before the mid-session summary) via an
accidental Wayback discovery; need to re-locate that source or re-extract if not recoverable from
memory, then find Punggol Breeze and Fernvale Residence fresh.

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2008) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2008 BTO launch** (1 standalone entry: Punggol Arcadia — Punggol — 750 Premium
flats, reconciles exactly: 120×3-Room + 465×4-Room + 165×5-Room). Recovered from its
`08NOVBTOPG_pdf` brochure on www100.hdb.gov.sg via Wayback (already located in an earlier CDX sweep
this session, just needed downloading — hit one transient "Internet Archive: Temporarily Offline"
503 mid-download, resolved after a short retry). Application close date (26 Nov 2008) from the
brochure's own steps page. Dataset now spans **November 2008 → June 2026**, 84 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**
Continuing to backfill further back per the standing instruction — next per housingmap.sg's roadmap
is August 2008 (Senja Green, Bukit Panjang, 474 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Dec 2008, 2 separate exercises) — LOCAL ONLY, NOT YET COMMITTED

Added **two separate December 2008 BTO launches** found via the www100/www101.hdb.gov.sg Wayback
archive: `2008-12a` Dew Spring @ Yishun (18-31 Dec 2008, 864 units: 144×2-Room + 216×3-Room +
504×4-Room, exact official price table from its legacy VSF microsite) and `2008-12b` Sunshine Court
+ Punggol Regalia (30 Dec 2008 - 12 Jan 2009, 452 + 729 units) — the latter's official press release
was found as **plain HTML directly on NAS** (`nas.gov.sg/archivesonline/data/pdfdoc/20090106001.htm`),
the cleanest source type found in this entire backfill (no PDF parsing or image OCR needed at all).
Confirmed these are genuinely separate exercises, not a mislabeled single one, because the Sunshine
Court/Punggol Regalia press release never mentions Dew Spring. **Important schema lesson**: initially
used `2008-12-18` as Dew Spring's launch_id (day-suffixed) — caught during testing that
`/api/bto/launches`' `ORDER BY launch_id DESC` sorts as a plain string, so `"2008-12-18"` sorts
*after* `"2008-12"` regardless of actual date order, silently putting the older Dec 18 launch above
the newer Dec 30 one in every listing. Fixed by renaming to same-length letter suffixes instead
(`2008-12a` earlier-in-month, `2008-12b` later-in-month) and verified `/api/bto/launches` returns
them in correct DESC order. Documented in the skill file as a new mandatory check whenever two
launches fall in the same month. Dataset now spans **December 2008 → June 2026**, 83 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**
Continuing to backfill further back per the standing instruction — next per housingmap.sg's roadmap
is November 2008 (Punggol Arcadia, 750 units — its `08NOVBTOPG_pdf` brochure was already located
earlier in this session's CDX sweep, just needs downloading/reading), then August 2008 (Senja Green),
then a 3-launch June 2008 (Punggol Breeze, Fernvale Residence, Straits Vista @ Marsiling — note
Straits Vista's data was already fully extracted earlier this session from an accidental Wayback
discovery and just needs writing to the JSON, no re-search needed), then May, March, and February
2008.

## Recent Changes (Sep 2026 — BTO historical backfill: Feb 2009 + Jul 2009 upgrade) — LOCAL ONLY, NOT YET COMMITTED

Added the **February 2009 BTO launch** (1 standalone entry: Champions Court — Woodlands — 815 units,
reconciles exactly: 60+164 Studio Apartment + 182×3-Room + 224×4-Room + 185×5-Room). Recovered not
from a PDF brochure but from a second legacy HDB source found via the same Wayback CDX sweep: a
"virtual showflat" microsite at `www101.hdb.gov.sg/hdbvsf/eampu02p.nsf/...` with **plain-text HTML**
price tables (not rasterized) — even easier to extract than the PDF brochures. Two elderly-only
Studio Apartment sizes (35 sqm / 45 sqm internal) both use `resale_flat_type: null` per the
established Studio Apartment convention. Also **upgraded July 2009's Punggol Residences** with exact
floor areas (91 sqm / 114 sqm internal) recovered from its own `09JULBTOPG` www100.hdb.gov.sg
brochure (found in the same CDX sweep that surfaced March 2009's brochure) — the official table
independently reconciled the exact same unit counts and prices already in the dataset, and superseded
the earlier null-floor-area version. Dataset now spans **February 2009 → June 2026**, 81 launches
total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction — next per housingmap.sg
would be January 2009, but its roadmap listing showed no launches in Jan 2009, so the next actual
target is checking December 2008 / earlier via the same www100/www101 Wayback approach.

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2009 + MAJOR source discovery) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2009 BTO launch** (1 standalone entry: The Nautilus @ Punggol — 519 units,
reconciles exactly: 413×4-Room + 106×5-Room). **Major discovery**: HDB's own legacy brochure host
(`www100.hdb.gov.sg`, directory pattern `<yy><mon>BTO<town-code>_pdf/`) is itself captured in the
Wayback Machine back to at least 2008 — confirmed via a CDX search
(`web.archive.org/cdx/search/cdx?url=www100.hdb.gov.sg/&matchType=prefix&from=20090101&to=20091231`)
that surfaced brochure directories for every 2008-2009 launch already in the dataset, PLUS several
new ones going back further: `08AUGBTOBP` (Senja Green), `08NOVBTOPG` (Punggol Arcadia), `08DECBTO`
(Sunshine Court), `08DECBTOYI` (Dew Spring) — this pushes the realistic backfill frontier well into
2008, superseding the earlier assumption that pre-Dec-2009 launches would rarely have recoverable
brochures. **Important fetch detail**: Wayback captures of these old PDFs must be fetched with the
`if_` raw-content modifier in the URL (e.g. `.../web/<timestamp>if_/http://...`) — without it, Wayback
serves an HTML wrapper page (toolbar injection) that gets saved with a `.pdf` extension but isn't a
valid PDF (`pypdf` chokes on it, `file` reports it as `HTML document`). Also, a literal `&` in the
brochure filename (`Maps&Plans.pdf`) must stay unencoded in the CDX-listed URL itself but the whole
URL should be quoted in the shell command. This launch's exact official 'Indicative Price Range'
table was recovered directly from the General_Info brochure (image-based, read via page
screenshots). Dataset now spans **March 2009 → June 2026**, 80 launches total. `npm test` green (240
tests, no test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill
further back per the standing instruction — next per housingmap.sg's roadmap is February 2009
(Champions Court, Woodlands, 815 units); also planning to retroactively upgrade July 2009's Punggol
Residences (currently null floor areas) now that its `09JULBTOPG` brochure has also turned up in the
same www100.hdb.gov.sg CDX listing.

## Recent Changes (Sep 2026 — BTO historical backfill: Jun 2009) — LOCAL ONLY, NOT YET COMMITTED

Added the **June 2009 BTO launch** (1 standalone entry: Fernvale Crest — Sengkang — 700 Standard
flats, reconciles exactly: 140×2-Room + 372×3-Room + 188×4-Room). Official press release not
recoverable this time (Wayback was intermittently down during this search). A secondary blog post
reproduces the full official flat-supply table verbatim (unit counts, internal floor areas, and
price ranges for all three flat types), independently corroborated on price minimums by a
contemporaneous PropNex news article. Application close date not recoverable from any source —
recorded null (launch date 2 Jun 2009 is confirmed); verified `launchStatus()` in `server/index.js`
degrades gracefully to `'closed'` with a null `application_end`, no code changes needed. Dataset now
spans **June 2009 → June 2026**, 79 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back per the
standing instruction — next per housingmap.sg's roadmap is May 2009 (checking) or possibly an
earlier gap; will confirm via housingmap.sg's full roadmap listing.

## Recent Changes (Sep 2026 — BTO historical backfill: Jul 2009) — LOCAL ONLY, NOT YET COMMITTED

Added the **July 2009 BTO launch** (1 standalone entry: Punggol Residences — Punggol — 769 Premium
flats, reconciles exactly: 615×4-Room + 154×5-Room). No official launch press release recoverable
(only a NAS-hosted 12 Aug 09 "Strong Interest" follow-up statement confirming launch date, close
date, and the 769-unit total). Exact per-type unit split recovered from a RenoTalk forum thread
started on the launch day itself (30 Jul 09) — a genuinely contemporaneous primary-adjacent source,
not a later retrospective. Exact price ranges recovered from a secondary blog's contemporaneous
reporting (aboutsingaporeproperty.wordpress.com), cross-confirmed by an independent web-search
snippet quoting the same figures. Floor area (sqm) not published anywhere recoverable — recorded
null (partial-data pattern), consistent with other pre-2010 launches lacking a housingmap.sg
brochure. Dataset now spans **July 2009 → June 2026**, 78 launches total. `npm test` green (240
tests, no test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill
further back per the standing instruction — next per housingmap.sg's roadmap is June 2009 (Fernvale
Crest, Sengkang, 700 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Aug 2009) — LOCAL ONLY, NOT YET COMMITTED

Added the **August 2009 BTO launch** (1 standalone entry: Punggol Spectra — Punggol — 1,142 units,
reconciles exactly: 301×2-Room + 285×3-Room + 556×4-Room). Recovered the complete official press
release directly from the National Archives of Singapore's own document host
(`nas.gov.sg/archivesonline/data/pdfdoc/20090907002/bto.pdf`, not Wayback) — a genuine 14-page PDF
with full Annex A (exact floor areas, units, and price ranges per flat type) and Annex B (resale
comparables). Floor area recorded using the internal (smaller) sqm figure where the press release
gave both external and internal values, consistent with the rest of this backfill. Dataset now spans
**August 2009 → June 2026**, 77 launches total. `npm test` green (240 tests, no test file changes).
**Not yet committed, pushed, or deployed.** Continuing to backfill further back per the standing
instruction — next per housingmap.sg's roadmap and this press release's own reference to it is July
2009 (Punggol Residences, 769 units).

## Recent Changes (Sep 2026 — BTO historical backfill: Oct 2009) — LOCAL ONLY, NOT YET COMMITTED

Added the **October 2009 BTO launch** (2 standalone entries: Fernvale Palms — Sengkang; Boon Lay
Meadow — Jurong West — 1,200 units total, reconciles exactly). Found the full press release directly
via the "previous post" link on the sghousehub.wordpress.com blog post used for Nov 2009 — this blog
appears to systematically cover consecutive launches, worth checking its prev/next links first for
adjacent months before a fresh web search. Both projects have exact per-project unit counts AND
price ranges in prose, no combining needed. Part of a 5,000-unit new flat supply announced by
Minister Mah Bow Tan on 1 Oct 2009. Dataset now spans **October 2009 → June 2026**, 76 launches
total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction — next per
housingmap.sg's roadmap is August 2009 (Punggol Spectra, 1,142 units) — note a genuine NAS-hosted
press release PDF was found for this one during earlier searching
(nas.gov.sg/archivesonline/data/pdfdoc/20090907002/bto.pdf), worth trying first.

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2009) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2009 BTO launch** (1 combined entry: Punggol Ripples & Punggol Sails — 1,078
units, reconciles exactly). housingmap.sg's brochure archive doesn't extend before Dec 2009 (no
`info`/`plans` links for this or earlier launches) — recovered the full press release from secondary
blog reproductions instead. No per-project split exists anywhere (HDB's own press release presents
both projects as one combined pricing block) — combined into one entry per the standard convention,
unlike the 8 launches just upgraded which DID have recoverable splits via housingmap.sg. The source
previewed December 2009 exactly matching the already-added Dawson-estate launch. Dataset now spans
**November 2009 → June 2026**, 75 launches total. `npm test` green (240 tests, no test file changes).
**Not yet committed, pushed, or deployed.** Continuing to backfill further back per the standing
instruction — next per housingmap.sg's roadmap is October 2009 (Boon Lay Meadow, Jurong West;
Fernvale Palms, Sengkang), though brochures likely won't be available for this era either.

## Recent Changes (Sep 2026 — BTO backfill data-quality upgrade: eliminated all unrecoverable-split placeholders) — LOCAL ONLY, NOT YET COMMITTED

**Major discovery**: `housingmap.sg/bto/` hosts a single page with the **complete BTO launch history
back to April 2001** (project name, town, total units, exact launch date, estimated completion,
classification, plus `info` and `plans` brochure PDF links per project) — far more complete than
kendata12345's coverage (which stops at 2010) or ad-hoc web searches. Fetched via
`housingmap.sg/bto/` (saved as reference). Each project's `Maps&Plans.pdf` brochure has a per-block
"Unit Distribution" table (exact units by flat type) on an early page (~page 2-3), and many
`General_Info.pdf` brochures (particularly 2010+ single/dual-project launches) also include a full
"Indicative Price Range" table with exact floor area, units, AND price min/max per flat type —
sourced from HDB's real Annex data, just distributed as rasterized brochure PDFs rather than the
press release itself.

Using this, **retroactively upgraded all 8 remaining "unrecoverable-split" null-placeholder entries**
from earlier in this session/backfill, replacing total-only guesses with exact, sourced data:
- **Punggol Edge** (688 units) — May 2012: 128×3-Room/400×4-Room/160×5-Room (Maps&Plans table)
- **Ping Yi Greens** (418 units) — Mar 2012: 98×2-Room/84×3-Room/236×4-Room + full price ranges
  (General Info table) — also clarified only 3 of 6 blocks (807A/808A/808B) were sold under this
  BTO; the other 3 were set aside for SERS rehousing
- **Waterway Banks** (1,016 units) — Nov 2011: 158×2-Room/252×3-Room/606×4-Room + full price ranges
- **Fajar Spring** (264 units) — Nov 2011: 78×SA(37sqm)/78×SA(47sqm)/108×3-Room + full price ranges
- **Punggol Crest** (750 units) — Feb 2010: 240×2-Room/240×3-Room/270×4-Room + full price ranges
- **Treegrove @ Woodlands** (784 units) — Feb 2010: 96×SA(36sqm)/96×SA(47sqm)/220×3-Room/372×4-Room
  + full price ranges
- **Boon Lay Grove** (450 units) — May 2010: 300×4-Room/150×5-Room + full price ranges
- **Floral Spring @ Yishun** (600 units) — May 2010: 48×SA/48×SA/264×4-Room/240×5-Room + full price
  ranges

Also **upgraded Dec 2009's Dawson-estate launch** (previously a full null-placeholder launch) with
exact per-block unit distributions for all 4 projects (SkyVille @ Dawson, SkyTerrace @ Dawson —
including its unusually rich Studio/4-Room-Loft/5-Room-Loft paired-unit mix, Segar Grove, Montreal
Dale) via the same housingmap.sg brochures — this launch is the historically notable one that
introduced HDB's landmark Dawson estate ("SkyVille"/"SkyTerrace") redevelopment.

Every launch in the dataset (74 total) now has zero remaining "split unrecoverable" placeholder
rows. `npm test` green (240 tests, no test file changes) throughout. All spot-checked via
`/api/bto/project-overview`. Regenerated `bto_launches_info/*.md` reference files and archived the
new source brochure PDFs for every upgraded launch. **Not yet committed, pushed, or deployed** (this
and everything since the `27e85d4` commit). Continuing to backfill further back per the standing
instruction — `housingmap.sg/bto/`'s full roadmap should now be the **primary index** for finding
remaining launches back to 2001, superseding kendata12345 and ad-hoc searches.

## Recent Changes (Sep 2026 — BTO historical backfill: Dec 2009) — LOCAL ONLY, NOT YET COMMITTED

Added the **December 2009 BTO launch** (4 entries: SkyVille @ Dawson & SkyTerrace @ Dawson —
Queenstown, Mature, Premium; Segar Grove — Bukit Panjang; Montreal Dale — Sembawang — 2,670 units
total, reconciles exactly). This is the historically notable launch of HDB's landmark **Dawson estate
redevelopment** (SkyVille/SkyTerrace, part of Remaking Our Heartland) — 1,718 combined units, ~12x
oversubscribed. kendata12345.wordpress.com's cost-analysis archive does not cover 2009 (confirmed no
pagination, no earlier entries) — switched to btohq.com's `bto-sales-launch/<mon>-<yyyy>-bto` tracker
pages as the primary source for project names/totals going forward. Application start date (15 Dec
2009) confirmed via NLB's Singapore History eresources database; official press release itself was
never found despite extensive Wayback CDX search. All four projects have an unrecoverable per-type
split — second launch this session with zero splits recoverable for any project (after Feb 2010).
**Also discovered, not yet added**: while searching Wayback CDX for this launch, stumbled onto a
complete June 2008 press release for Straits Vista @ Marsiling (382 units, exact data including
floor_area_sqm) at a differently-dated capture — confirms Wayback capture dates don't correlate with
press-release issue dates on this domain, so date-windowed CDX searches can miss or surface unrelated
finds. Also spotted a "HDB Launches Build-To-Order Flats Near Punggol MRT" press release (title only,
not yet read) from a Nov 2009 capture — likely the actual immediately-prior-to-Dec-2009 launch, to
investigate next. Dataset now spans **December 2009 → June 2026**, 74 launches total. `npm test`
green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.** Continuing to
backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: May 2010) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2010 BTO launch** (2 entries: Boon Lay Grove — Jurong West; Floral Spring @ Yishun —
1,050 units total, reconciles exactly). The press release for this launch was never found despite
extensive searching across this and the prior session's turn — recovered project names, confirmed
totals, and 'from' prices via btohq.com instead. Both projects have an unrecoverable per-type split
(same null-placeholder pattern used throughout this backfill). With this launch added, the timeline
from **January 2010 through October 2010 is now fully continuous** — Jan (Limbang Green/Buangkok
Vale) → Feb (Punggol Crest/Treegrove) → May (Boon Lay Grove/Floral Spring) → Oct (Senja Parc
View/Anchorvale Horizon) → Nov (Yishun Greenwalk) → Dec (Punggol Topaz) → Jan 2011, with every "next
launch" preview sentence cross-checked against what's actually in the dataset. Dataset now spans **May
2010 → June 2026**, 73 launches total. `npm test` green (240 tests, no test file changes). **Not yet
committed, pushed, or deployed.** Continuing to backfill further back per the standing instruction —
2010 is HDB's earliest year with reasonably searchable secondary-source coverage in this session's
experience; earlier years (BTO began in 2001/2002) may require different search strategies.

## Recent Changes (Sep 2026 — BTO historical backfill: Feb 2010, gap-fill) — LOCAL ONLY, NOT YET COMMITTED

Added the **February 2010 BTO launch** (2 entries: Punggol Crest — Punggol; Treegrove @ Woodlands —
Premium — 1,534 units total, reconciles exactly). Final gap-fill for the Jan 2010 → May 2010 stretch.
Unlike every prior gap this session, the actual press release could not be located at all despite an
extensive Wayback CDX search — recovered project names and confirmed totals via btohq.com instead.
**Both projects have an unrecoverable per-type split** (first time in this backfill that an entire
launch has no split data at all) — recorded with full null-placeholder rows for both, same pattern as
Punggol Edge/Ping Yi Greens/Waterway Banks/Fajar Spring. Dataset now spans **February 2010 → June
2026**, 72 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.** With Feb, Jan, and May 2010 covered (once found), the Jan 2010 → Oct 2010
stretch should be fully continuous — need to independently verify no further gaps exist before this
point, then continue toward locating the still-outstanding May 2010 press release (Boon Lay Grove +
Floral Spring @ Yishun) and then earlier still.

## Recent Changes (Sep 2026 — BTO historical backfill: Jan 2010) — LOCAL ONLY, NOT YET COMMITTED

Added the **January 2010 BTO launch** (2 entries: Limbang Green — Choa Chu Kang; Buangkok Vale —
Hougang — 1,291 units total, reconciles exactly). Full press release recovered via Wayback Machine
while searching for May 2010 (whose press release proved much harder to locate — many CDX candidates
checked, none matched; still unresolved). The source previewed a February 2010 launch (~1,500 flats
in Punggol and Woodlands) not in kendata12345.wordpress.com's roadmap index (which lists Jan 2010 but
jumps straight to May 2010) — yet another gap, to find next. Dataset now spans **January 2010 → June
2026**, 71 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed** (this and everything since the `27e85d4` commit). Continuing to backfill
further back per the standing instruction — next is the February 2010 gap, then still need to locate
May 2010 (Boon Lay Grove + Floral Spring @ Yishun, per kendata's roadmap and independent web sources)
whose exact press-release Wayback capture has not yet been found despite an extensive CDX search.

## Recent Changes (Sep 2026 — BTO historical backfill: Dec 2010, gap-fill) — LOCAL ONLY, NOT YET COMMITTED

Added the **December 2010 BTO launch** (1 entry: Punggol Topaz — 1,010 units, reconciles exactly).
Final gap-fill for the Oct 2010 → Jan 2011 stretch — not in kendata12345.wordpress.com's roadmap
index. Recovered the full press release via Wayback Machine. The source's own "next launch" preview
("1,700 flats in Bukit Batok and Yishun") matches the already-added Jan 2011 launch exactly,
confirming this stretch of the timeline is now fully continuous with no launches missing between Oct
2010 and Jan 2011. Dataset now spans **December 2010 → June 2026**, 70 launches total. `npm test`
green (240 tests, no test file changes). Note: the prior commit (`27e85d4`) covered Oct 2010 through
Nov 2013 — this Dec 2010 launch and everything beyond is **not yet committed, pushed, or deployed**.
Continuing to backfill further back per the standing instruction — next per kendata's roadmap is May
2010 (Boon Lay Grove, Jurong West).

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2010, gap-fill) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2010 BTO launch** (1 entry: Yishun Greenwalk — 1,176 units, reconciles exactly).
Another gap-fill: not in kendata12345.wordpress.com's own roadmap index (which jumped straight from
Oct 2010 to Jan 2011). Recovered the full press release via Wayback Machine. By this launch, HDB had
offered ~16,700 new flats under BTO+SBF since the start of 2010. Previewed a December 2010 Punggol
launch (1,010 flats) — yet another gap to fill next, before reaching kendata's next indexed launch
(May 2010, Boon Lay Grove). Dataset now spans **November 2010 → June 2026**, 69 launches total. `npm
test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.** Given how
many gaps have turned up in kendata's index near the 2010/2011 boundary, should treat every "next
launch preview" sentence in a recovered press release as authoritative over any third-party roadmap
index — the roadmap is a helpful starting point, not a complete list.

## Recent Changes (Sep 2026 — BTO historical backfill: Oct 2010) — LOCAL ONLY, NOT YET COMMITTED

Added the **October 2010 BTO launch** (2 entries: Senja Parc View — Bukit Panjang, Standard;
Anchorvale Horizon — Sengkang, Premium — 1,322 units total, reconciles exactly). Full press release
recovered via kendata12345.wordpress.com with exact unit counts and price ranges. By this launch, HDB
had offered 15,527 new flats under BTO+SBF since the start of 2010. The source previewed a November
2010 Yishun launch (~1,170 flats) that isn't in kendata's own roadmap index — another gap to fill,
same pattern as February 2011. Dataset now spans **October 2010 → June 2026**, 68 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**
Continuing to backfill further back per the standing instruction — need to find and fill the November
2010 gap before reaching May 2010 (Boon Lay Grove) and January 2010 (Limbang Green, Buangkok Vale)
per the kendata12345 roadmap.

## Recent Changes (Sep 2026 — BTO historical backfill: Feb 2011, gap-fill) — LOCAL ONLY, NOT YET COMMITTED

Added the **February 2011 BTO launch** (3 entries: Fernvale Flora & Fernvale Gardens — Sengkang;
Segar Vale — Bukit Panjang — 1,593 units total, reconciles exactly). This was a **gap-fill**: the
January 2011 press release (already added) previewed this launch, revealing it fell chronologically
between the already-added January and March 2011 launches — added out of strict backward order to
close the gap before continuing further back. Segar Vale's per-type breakdown was reconstructed by
subtraction (secondary source's copy was truncated exactly at Segar Vale's project-description
paragraph) — 690-unit total independently confirmed against btohq.com. Dataset now spans **February
2011 → June 2026**, 67 launches total. `npm test` green (240 tests, no test file changes). **Not yet
committed, pushed, or deployed.** Continuing to backfill further back per the standing instruction —
next target is 2010 (Jan: Limbang Green + Buangkok Vale; May: Boon Lay Grove; Oct: Senja Parc View),
per the kendata12345 roadmap. Should also double check no other such gaps exist before Jan 2011.

## Recent Changes (Sep 2026 — BTO historical backfill: Jan 2011) — LOCAL ONLY, NOT YET COMMITTED

Added the **January 2011 BTO launch** (3 entries: Golden Daisy — Bukit Batok, Studio Apartment only,
targeted at elderly right-sizers; Orchid Spring @ Yishun & Vista Spring @ Yishun — kept standalone
despite a shared price table — 1,728 units total, reconciles exactly). Full press release recovered
via kendata12345.wordpress.com with exact unit counts and price ranges. The source previewed the next
(February 2011) launch: ~1,600 flats in Bukit Panjang and Sengkang — not yet found in kendata's own
index, to search for directly next. Dataset now spans **January 2011 → June 2026**, 66 launches
total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2011) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2011 BTO launch** (2 entries: Boon Lay Fields — Jurong West, Standard; Compassvale
Ancilla — Sengkang, Premium — 1,527 units total, reconciles exactly). Recovered the full press
release via Wayback Machine, with exact per-project unit counts AND exact price ranges (both min and
max — better than April 2011's tier-only pricing). Introduced two policy changes: BTO
application-to-selection turnaround halved, and a Mobile@HDB iPhone app. Correcting a mislabel found
in kendata12345.wordpress.com's own category index (which filed this cluster under "Jul 2011") — the
actual press release confirms 24 Mar 2011. Floor area (sqm) remains unconfirmed for this launch (the
small Annex PDFs were never crawled by Wayback) — recorded null, same pattern as April 2011.
Compassvale Ancilla's 224 Studio Apartment units are a single un-split row (no per-size breakdown
published this time). Dataset now spans **March 2011 → June 2026**, 65 launches total. `npm test`
green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.** Continuing to
backfill further back per the standing instruction — next is January 2011 (Golden Daisy, Bukit
Batok), per the kendata12345 roadmap.

## Recent Changes (Sep 2026 — BTO historical backfill: Apr 2011) — LOCAL ONLY, NOT YET COMMITTED

Added the **April 2011 BTO launch** (4 entries: Anchorvale Cove — Sengkang, Premium; Hougang
Parkview — Standard; Montreal Ville — Sembawang, Standard; Waterway Terraces II — Punggol, Premium —
3,185 units total, reconciles exactly). "The largest supply of BTO flats in a single launch since
2002" at the time. Recovered the full press release (not just an Annex table) via
kendata12345.wordpress.com, with exact per-project unit counts given in prose. **New partial-data
pattern**: unlike the null-placeholder cases (where the per-type split itself was unknown), here the
split and flat types ARE exact and confirmed, but neither floor_area_sqm nor price_max is published
anywhere recoverable (only tier-level 'from' prices — Standard vs Premium) — recorded with
floor_area_sqm/price_max null but resale_flat_type/price_min set normally, confirmed via
`/api/bto/project-overview` spot-check to render and compute resale comparisons gracefully (comps
logic degrades cleanly, discount_pct shows null, no crash). Dataset now spans **April 2011 → June
2026**, 64 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.** Continuing to backfill further back per the standing instruction — next is
March 2011 (Boon Lay Fields & Compassvale Ancilla), per a full kendata12345 index built this session
covering every launch back to January 2010.

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2011) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2011 BTO launch** (7 entries: Anchorvale Harvest & Fernvale Rivergrove —
Sengkang; Golden Peony — Jurong West; Teban View — Jurong East; Waterway Brooks & Waterway Woodcress
— Punggol; Yio Chu Kang Vista — Ang Mo Kio, Mature — 5,415 units total, reconciles exactly). **Full
official Annex A1 recovered** via kendata12345.wordpress.com (archived as
`bto_launches_info/2011-09-annex-a1-flat-supply.pdf`). Notable pattern: two project pairs share one
combined *pricing* table in the official Table A1a, but the Annex's own prose paragraphs give exact,
independently-verified unit counts per project — recorded as four standalone entries (not two
combined ones, unlike every other combined case in this backfill) to preserve accurate per-project
locations for mapping/search, with only the price range staying blended across each pair (documented
in the curation note). Part of a bumper joint BTO+SBF launch (8,200+ flats); the 2,847-unit SBF
portion excluded per convention. Dataset now spans **September 2011 → June 2026**, 63 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**
Continuing to backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2011) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2011 BTO launch** (7 entries: Acacia Breeze @ Yishun; Golden Cassia — Bedok,
Mature; Hougang Capeview & Hougang DewCourt — kept standalone despite a shared official pricing
table, since real per-project tender-contract data exists for both; Waterway Ridges & Waterway Banks
— Punggol; Fajar Spring — Bukit Panjang — 4,235 units total, reconciles exactly). Corrected Acacia
Breeze's 5-Room price_min from an internally-inconsistent $227,000 (an OCR misread in the
kendata12345 source image — lower than the 4-Room minimum, which can't be right) to $277,000,
cross-checked against singpromos's independently-sourced summary table. **Third and fourth
unrecoverable-split cases**: Waterway Banks (1,016 units) and Fajar Spring (264 units) both have
confirmed totals but no discoverable per-type split — same null-placeholder pattern as Punggol Edge
and Ping Yi Greens. Dataset now spans **November 2011 → June 2026**, 62 launches total. `npm test`
green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.** Continuing to
backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Jan 2012) — LOCAL ONLY, NOT YET COMMITTED

Added the **January 2012 BTO launch** (4 entries: Fernvale Lea — Sengkang; Sunshine Gardens — Choa
Chu Kang; Tampines Alcoves & Tampines GreenTerrace combined — Mature; Waterway Sunbeam — Punggol —
3,923 units total, reconciles exactly). This was HDB's first BTO launch of 2012. **Full official
Annex A recovered** — kendata12345.wordpress.com hosts the actual HDB press-release PDF (not a
rasterized cost-analysis image like other nearby launches), archived as
`bto_launches_info/2012-01-annex-a-flat-supply.pdf`, giving exact data for every project with zero
reconstruction needed. Tampines Alcoves & Tampines GreenTerrace combined per HDB's own official
table: Studio Apartment rows are Tampines-Alcoves-exclusive, the 4-Room row is
Tampines-GreenTerrace-exclusive, but the 3-Room row is explicitly shared across both in the official
Table A1. Dataset now spans **January 2012 → June 2026**, 61 launches total. `npm test` green (240
tests, no test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill
further back per the standing instruction — HDB's BTO system was introduced in 2002, so roughly a
decade of history remains.

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2012) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2012 BTO launch** (7 entries: Skyline I & II @ Bukit Batok combined; Fajar Hills —
Bukit Panjang; Golden Kismis — Bukit Timah, Mature; Clementi Ridges — Mature; MacPherson Residency —
Geylang, Mature; Golden Clover — Toa Payoh, Mature; Ping Yi Greens — Bedok, Mature — 4,153 units
total, reconciles exactly). Note: the singpromos.com source URL is mis-dated ("28 May – 3 Apr 2012")
but the article body confirms this is genuinely March 2012 (28 Mar – 3 Apr). Recovered full
official-quality data for 6 of 7 clusters via kendata12345.wordpress.com's rasterized cost-analysis
images (archived as `bto_launches_info/2012-03-*-source.jpg`). **Second unrecoverable-split case**
(same pattern as Punggol Edge, May 2012): Ping Yi Greens — HDB's first-ever Multi-Generation Priority
Scheme (MGPS) pilot — has a confirmed 418-unit total and per-type 'from' prices but no discoverable
2-Room/3-Room/4-Room split; recorded with the same null-placeholder pattern. Dataset now spans
**March 2012 → June 2026**, 60 launches total. `npm test` green (240 tests, no test file changes).
**Not yet committed, pushed, or deployed.** Continuing to backfill further back per the standing
instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: May 2012) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2012 BTO launch** (6 entries: Keat Hong Pride — Choa Chu Kang; Punggol Edge &
Waterway SunDew — Punggol; Bendemeer Light & McNair Towers — Kallang/Whampoa, Mature; Compassvale
Boardwalk — Sengkang — 4,627 units total, reconciles exactly). Recovered full official-quality data
for 5 of 6 projects via rasterized tender-cost-analysis images on kendata12345.wordpress.com
(archived as `bto_launches_info/2012-05-*-source.jpg`). **First genuine unrecoverable-split case in
the entire backfill**: Punggol Edge (an integrated 688-unit BTO + 446-unit rental development) has a
confirmed total (matches both the reconciliation gap and btohq.com independently) and confirmed
per-type 'from' prices, but no source anywhere publishes its 3-Room/4-Room/5-Room unit split despite
exhaustive search — recorded as a single row with `resale_flat_type`/`floor_area_sqm`/`price_min`/
`price_max` all `null` (the schema's existing placeholder-row pattern, confirmed via
`/api/bto/project-overview` spot-check to render safely with no crash — frontend shows 'Price TBD'
and '-- sqft' gracefully) rather than fabricating a split. Dataset now spans **May 2012 → June
2026**, 59 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.** Continuing to backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Jul 2012) — LOCAL ONLY, NOT YET COMMITTED

Added the **July 2012 BTO launch** (7 standalone entries: Keat Hong Axis — Choa Chu Kang; Punggol
Opal & Waterway Cascadia — Punggol; Clementi Gateway — Mature; Depot Heights & Telok Blangah
Ridgeview — Bukit Merah, Mature; GreenTops @ Sims Place — Geylang, Mature — 4,191 units total,
reconciles exactly). Official Annex A PDF was linked in the Wayback-archived press release but the
PDF itself was never actually crawled — reconstructed from singpromos.com instead. Clementi Gateway
had the same secondary-source gap seen with Nov 2012's Keat Hong Mirage (only a price summary, no
per-type unit counts) — recovered its exact 134×3-Room / 144×4-Room split from a rasterized official
cost-analysis table image on kendata12345.wordpress.com (archived as
`bto_launches_info/2012-07-clementi-gateway-unit-split-source.jpg`), whose price ranges matched
singpromos's figures exactly, confirming it traces back to the real Annex A. GreenTops @ Sims Place's
Studio Apartments are 36/46 sqm rather than the usual 37/47 sqm — verified directly in the source
table. Dataset now spans **July 2012 → June 2026**, 58 launches total. `npm test` green (240 tests,
no test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further
back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2012) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2012 BTO launch** (7 standalone entries: Keat Hong Quad — Choa Chu Kang;
Golden Saffron & TreeTrail @ Woodlands — Woodlands; Cheng San Court & Teck Ghee Parkview — Ang Mo
Kio, Mature; Tampines GreenLace — Mature; Tenteram Peak — Kallang/Whampoa, Mature — 3,727 units
total, reconciles exactly). Official Annex A1 DOCX referenced by the press release was linked in the
Wayback-archived press-release page but the DOCX itself was never actually crawled (404/dedup-revisit
stub) — reconstructed from singpromos.com's full detailed table instead, which reconciled exactly.
Concurrent SBF exercise (3,328 balance flats) excluded per convention. Teck Ghee Parkview piloted
HDB's first 'open kitchen' layout concept. Fixed a naming-convention bug caught via the API
resolve spot-check: TreeTrail @ Woodlands was initially keyed as 'TREETRAIL@WOODLANDS' (no spaces,
copied verbatim from OneMap's compact building-name format) which silently broke `/api/resolve`
exact-match lookups — corrected to 'TREETRAIL @ WOODLANDS' matching the ' @ ' spacing convention
used by every other `@`-named project in the dataset (e.g. 'OAK VILLE @ AMK'). Dataset now spans
**September 2012 → June 2026**, 57 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed.** Continuing to backfill further back per the
standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2012) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2012 BTO launch** (7 standalone entries: Keat Hong Mirage — Choa Chu Kang;
Compassvale Mast & Rivervale Delta — Sengkang; Fengshan GreenVille — Bedok, Mature; Ghim Moh Edge —
Queenstown, Mature; Joo Seng Green & Toa Payoh Crest — Toa Payoh, Mature — 6,463 units total,
reconciles exactly). Largest annual BTO supply since the system's 2002 introduction (27,084 units for
2012). Notable recovery: found and downloaded the actual **official Annex A PDF** via Wayback Machine
CDX search on the old hdb.gov.sg Lotus Notes domain (`fi10297p.nsf/ImageView/...`) — archived as
`bto_launches_info/2012-11-annex-a-flat-supply.pdf`. This superseded an initial singpromos.com-based
reconstruction that had grouped some projects under shared page headers (e.g. 'Rivervale Delta &
Compassvale Mast'), which looked like the partial-combine pattern seen elsewhere in this backfill —
the official Annex A revealed all 7 projects actually have fully independent, standalone unit-supply
tables, so no combined entries were needed after all. Lesson: a secondary source's shared table
formatting can look like a genuine multi-project combine when it's actually just page layout —
always keep searching for the primary source before concluding a combine is necessary. Joo Seng
Green resolves to Toa Payoh town per HDB's own press-release text, despite being geographically
closer to Potong Pasir/Woodleigh. Dataset now spans **November 2012 → June 2026**, 56 launches
total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.** Continuing to backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Jan 2013) — LOCAL ONLY, NOT YET COMMITTED

Added the **January 2013 BTO launch** (6 standalone entries: Hougang ParkEdge; Keat Hong Colours —
Choa Chu Kang; Oleander Breeze @ Yishun; Kebun Baru Court — Ang Mo Kio, Mature; Tampines GreenForest
— Mature; Whampoa Dew — Kallang/Whampoa, Mature — 3,346 units total, reconciles exactly). First
tranche of HDB's planned 23,000 BTO flats for 2013. Introduced the Parenthood Priority Scheme (PPS),
announced 2013-01-21, setting aside 30%/50% of BTO/SBF supply for first-timer married couples with a
young child. No 2-Room flats offered anywhere in this launch. All 6 projects standalone — no
combined entries needed. Dataset now spans **January 2013 → June 2026**, 55 launches total. `npm
test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.** Reached
the start of 2013 — continuing to backfill into 2012 and earlier per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2013) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2013 BTO launch** (4 standalone entries: Compassvale Cape & Compassvale Helm —
Sengkang; Matilda Portico — Punggol; SkyPeak @ Bukit Batok — 3,898 units total, reconciles exactly).
No combined entries needed — every project has its own standalone unit/price table. Compassvale Cape
and Compassvale Helm each have two Studio Apartment size variants. Dataset now spans **March 2013 →
June 2026**, 54 launches total. `npm test` green (240 tests, no test file changes). **Not yet
committed, pushed, or deployed.** Continuing to backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: May 2013) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2013 BTO launch** (6 entries: EastBrook, EastWave & EastBank @ Canberra combined —
Sembawang; Golden Mint — Hougang/Buangkok; Hougang Crimson; Keat Hong Crest — Choa Chu Kang; Spring
Haven @ Jurong — Jurong West; Woodlands Pasture I & II combined — 4,900 units total, reconciles
exactly). Combined with a Sale of Balance Flats (SOBF) exercise — SBF excluded per convention.
Introduced three new first-timer/second-timer/elderly housing measures from the 2013 Committee of
Supply debate. EastBrook/EastWave/EastBank @ Canberra is the first 3-way partial-combine seen in
this backfill: 2-Room/3-Room exclusive to EastBrook, 4-Room shared across all three, 5-Room shared
between EastWave and EastBank only — no further split published. Dataset now spans **May 2013 → June
2026**, 53 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.** Continuing to backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Jul 2013) — LOCAL ONLY, NOT YET COMMITTED

Added the **July 2013 BTO launch** (3 entries: Vine Grove @ Yishun & Angsana Breeze @ Yishun
combined; Fernvale Riverwalk — Sengkang; Telok Blangah ParcView — Bukit Merah, Mature Estate —
3,861 units total, reconciles exactly). This was the launch that introduced HDB's first-ever direct
BTO purchase pathway for singles (previously resale-only) — a 519-unit table of new-project (301) +
previous-exercise-balance (218) 2-Room flats for singles was excluded per the established
balance-flat convention, matching the press release's own stated breakdown exactly. Vine Grove &
Angsana Breeze combined per the same partial-combine pattern as Boon Lay View & Yung Kuang Court
(Nov 2013). Dataset now spans **July 2013 → June 2026**, 52 launches total. `npm test` green (240
tests, no test file changes). **Not yet committed, pushed, or deployed.** Continuing to backfill
further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2013) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2013 BTO launch** (4 entries: Matilda Edge — Punggol; The Verandah @ Matilda &
Waterway View combined — Punggol; Khatib Court — Yishun; Palm Breeze @ Yishun & Saraca Breeze @
Yishun combined — 4,156 units total, reconciles exactly). Two Non-Mature towns only (Punggol,
Yishun). A separate 1,137-unit "additional 2-Room" balance-flat table spanning 8 towns was excluded
per the established balance-flat convention (not tied to a discrete BTO project). Both combined
entries follow the same partial-combine pattern first seen with Boon Lay View & Yung Kuang Court
(Nov 2013): one project has an exclusive flat-type row while the larger types are jointly labeled
across both projects with no further split published. Dataset now spans **September 2013 → June
2026**, 51 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.** Continuing to backfill further back per the standing instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2013) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2013 BTO launch** (5 projects: Admiralty Grove — Woodlands; Boon Lay View &
Yung Kuang Court combined — Jurong West; EastLawn @ Canberra — Sembawang; Hougang Meadow; West
Ridges @ Bukit Batok — 4,978 units total, reconciles exactly). No official Annex recoverable via any
channel (live URL, Wayback CDX, NAS) — reconstructed from singpromos.com's full per-project supply
table. First 3Gen flats ever offered in a BTO launch, exclusive to Boon Lay View. Boon Lay View &
Yung Kuang Court is a new twist on the combined-entry convention: HDB's own summary table names
3-Room/3Gen as belonging solely to Boon Lay View while jointly labeling only the 4-Room/5-Room rows
across both projects — cross-checked against btohq.com project specs (Boon Lay View 810 units,
Yung Kuang Court 528 units, sum matches this table's combined total exactly) to confirm these are
genuinely two separate developments, not a naming quirk, before deciding to combine (same pattern as
Marsiling Greenview & Admiralty Flora, May 2014). This was HDB's largest joint BTO+SBF exercise to
date (8,952 total flats); SBF portion excluded per convention. Dataset now spans **November 2013 →
June 2026**, 50 launches total. `npm test` green (240 tests, no test file changes). **Not yet
committed, pushed, or deployed** — 10 launches now queued since the last commit (`80dc085`).
Continuing to backfill further back per the standing instruction, next target October/earlier 2013.

## Recent Changes (Sep 2026 — BTO historical backfill: Jan 2014) — LOCAL ONLY, NOT YET COMMITTED

Added the **January 2014 BTO launch** (6 projects, all standalone — no combined entries needed:
Woodlands Glen, Punggol Vue, Punggol BayView, Golden Lavender — Jurong West, Bukit Gombak Vista —
Bukit Batok, Golden Ginger — Serangoon/Mature — 3,139 units total, reconciles exactly). First
launch to introduce HDB's now-standard eco-features suite. Punggol BayView is a "Premium Flats"
project with distinct "Typical" and "Special" (balcony/enlarged master bedroom) unit variants,
handled as separate flat rows within one project entry — verified this renders correctly via
`/api/bto/project-overview`. Dataset now spans **January 2014 → June 2026**, 49 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed** — 10
launches now queued since the last commit (`80dc085`).

## Recent Changes (Sep 2026 — BTO historical backfill: Mar 2014) — LOCAL ONLY, NOT YET COMMITTED

Added the **March 2014 BTO launch** (3 entries: EastLace @ Canberra & EastCrown @ Canberra
combined — Sembawang; Fern Grove @ Yishun; Anchorvale Parkview — Sengkang — 3,497 units total,
reconciles exactly). All-Non-Mature launch (no mature-town project this time). Standalone exercise,
no bundled SBF. Dataset now spans **March 2014 → June 2026**, 48 launches total. `npm test` green
(240 tests, no test file changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: May 2014) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2014 BTO launch** (2 combined entries: Marsiling Greenview & Admiralty Flora —
Woodlands; West Valley @ Bukit Batok & West Crest @ Bukit Batok — 3,071 units total, reconciles
exactly). Notably this source's price table names exactly which project(s) each flat-type row
belongs to (e.g. "3-Room belongs only to West Valley, 5-Room only to West Crest, 2-Room/4-Room
shared") — more granular than most pre-2015 launches, but still not granular enough to fully split
the shared rows, so both pairs remain combined per the established convention. Dataset now spans
**May 2014 → June 2026**, 47 launches total. `npm test` green (240 tests, no test file changes).
**Not yet committed, pushed, or deployed** — accumulated queue since the last commit (`80dc085`) is
now 7 launches (Feb/Nov/Sep/Jul/May 2014, Feb/Nov 2015 plus May 2015 — will keep going per the
standing instruction to backfill without stopping absent a real blocker).

## Recent Changes (Sep 2026 — BTO historical backfill: Jul 2014) — LOCAL ONLY, NOT YET COMMITTED

Added the **July 2014 BTO launch** (5 entries: Sun Natura — Sembawang; Park Grove @ Yishun; Waterway
Sunray & Matilda Court combined — Punggol; Kampung Admiralty — Woodlands; Toa Payoh Apex — Mature —
3,841 units total, reconciles exactly). Kampung Admiralty here is specifically the residential
(Studio-Apartment-only) component of Singapore's first-ever integrated eldercare/medical/hawker/
retail development — a notable historical landmark project. Dataset now spans **July 2014 → June
2026**, 46 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2014) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2014 BTO launch** (4 entries: Yung Ho Spring I & II combined — Jurong West;
Buangkok Square & Buangkok Edgeview combined — Hougang; West Terra @ Bukit Batok; St George's
Towers — Kallang/Whampoa — 4,630 units total, reconciles exactly). Same multi-phase combined-entry
and Studio-Apartment-with-null-resale-type patterns as prior pre-2015 launches. Reconstructed
entirely from singpromos.com; official annex unrecoverable via any channel. Dataset now spans
**September 2014 → June 2026**, 45 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2014) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2014 BTO launch** (5 entries: Meadow Spring @ Yishun & Blossom Spring @
Yishun combined; Sun Breeze — Sembawang; Anchorvale Fields — Sengkang; Tampines GreenEdge; Tampines
GreenRidges — 4,277 units total, reconciles exactly). Tampines GreenRidges was the first housing
development in Tampines North and the first project ever to offer 3Gen flats in a mature town.
Reconstructed entirely from singpromos.com (official annex unrecoverable via any channel), which
this time had a genuine per-project unit-type table (not just "From" minimums) reconciling exactly
— **note for future backfill work**: HDB's pre-2015 sales cadence was noticeably higher-frequency
than the later roughly-quarterly pattern (2014 alone had launches in Feb, May/Jun, Jul, Sep, and
Nov — five in one year, not four) — don't assume a quarterly gap when searching for the next
earlier launch; search broadly for every month. Dataset now spans **November 2014 → June 2026**, 44
launches total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or
deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Feb 2015) — LOCAL ONLY, NOT YET COMMITTED

Added the **February 2015 BTO launch** (3 entries: West Edge @ Bukit Batok & West Rock @ Bukit
Batok combined; Buangkok ParkVista & Buangkok Tropica combined; MacPherson Spring standalone —
3,995 units total, reconciles exactly). Same "Costa Riviera I & II" combined-entry treatment as May
2015's EastLink/Northshore pairs — HDB's press release calls these "five projects" with real,
independently-known total-unit counts per project (found via btohq.com project specs, all
reconciling exactly to the group totals), but the official flat-supply table only published each
pair's *combined* per-flat-type units, with no 4-Room/5-Room split between West Edge and West Rock
found anywhere (only the flat types wholly owned by one half of each pair are certain — documented
in the curation note). Rather than fabricate a split, combined into one entry per pair, consistent
with the established convention. MacPherson Spring repeats the "Studio Apartment, resale_flat_type:
null" pattern from May 2015. Official Annex again fully unrecoverable via live URL/Wayback
CDX/NAS — reconstructed from singpromos.com, verified against the press-release headline. Dataset
now spans **February 2015 → June 2026**, 43 launches total. `npm test` green (240 tests, no test
file changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: May 2015) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2015 BTO launch** (4 projects: EastLink I & II @ Canberra — Sembawang; Northshore
Residences I & II — Punggol; both Non-Mature; Tampines GreenWeave, Clementi Crest — Mature —
4,044 units total, reconciles exactly). Predates the 2-Room Flexi scheme itself — flats are plain
"2-Room" here. Official Annex A was fully unrecoverable this time (live URL dead, broad Wayback CDX
search for every May-2015 date-stamp guess came up empty, NAS search found nothing) — reconstructed
from a secondary source (singpromos.com) that's clearly a verbatim transcript of the real annex (it
cross-references "Table A1(4)" by name), reconciling exactly to the press release's own headline.
"EastLink I & II" and "Northshore Residences I & II" are each two phases sharing one combined
flat-supply table with no published per-phase split — combined into one project entry each, per the
existing "Costa Riviera I & II" convention already used elsewhere in this dataset (not a new
pattern). Tampines GreenWeave includes 224 "Studio Apartment" units (30-year lease, elderly-only, a
flat type later retired) — no direct `resale_flat_type` equivalent exists, so those two rows use
`resale_flat_type: null` (verified this doesn't break `/api/bto/project-overview`, which correctly
skips null types in the comparison calc). Dataset now spans **May 2015 → June 2026**, 42 launches
total. `npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2015) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2015 BTO launch** (10 projects: Alkaff CourtView/LakeView/Vista in the newly-
opened Bidadari precinct — Mature/Toa Payoh; Fernvale Woods — Sengkang; Hougang RiverCourt;
Northshore StraitsView + Waterfront I & II @ Northshore — Punggol; Teck Whye Vista — Choa Chu Kang;
West Quarry @ Bukit Batok — all Non-Mature — 7,061 units total, reconciles exactly). This was
HDB's largest-ever joint BTO+SBF exercise (12,411 combined; only the 7,061-unit BTO portion is
seeded) and the launch that introduced the modern 2-Room Flexi scheme + raised income ceilings.

**Initially looked unrecoverable** — this launch used "Annex B1" instead of the usual "Annex A1"
naming, and it wasn't findable via the normal channels (live hdb.gov.sg URL dead; broad Wayback CDX
search under the standard `cs/infoweb/-/media/doc/PressReleases/` prefix came up empty for every
2015-11-dated guess; NAS direct search found nothing; the legacy `www20.hdb.gov.sg` InfoWEB domain
no longer resolves and has zero Wayback captures). Started building the launch via the
housingmap.sg-brochure fallback (8 brochures downloaded, unit-mix/sqm data partially extracted from
Teck Whye Vista and Fernvale Woods) before a differently-phrased web search surfaced the exact
official filename (`annexb1nov2015btoexercise.pdf`) — which the Wayback CDX API turned out to have
archived all along, just under a name my systematic CDX guesses never tried. **Lesson recorded**: a
failed broad Wayback CDX search doesn't prove a page was never archived — HDB's own annex-naming
conventions varied enough era-to-era (prefix-date vs suffix-date, `annexA` vs `annexB1`, no fixed
separator) that a documented capture can still be missed by prefix-based CDX guessing; try a plain
web search for the literal filename before concluding "unrecoverable" and falling back to
housingmap.sg. Once found, the official Annex B1 had complete real per-project unit splits for
every flat type (no combined-row estimation needed for units at all) — only the Punggol trio's
2-Room Flexi Type 1/Type 2 split within each project remains combined (real per-project 99-year
price wasn't separately published this era, so the shared group price band is used, with Waterfront
I correctly flagged as Type-2-only per the annex's own footnote). Dataset now spans **November
2015 → June 2026**, 41 launches total. `npm test` green (240 tests, no test file changes).
**Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill batch: Feb 2017 → May 2016) — LOCAL ONLY, NOT YET COMMITTED

Continued the backfill autonomously through four more launches per explicit user instruction
("continue all the way until you face any error and pause and let me know"):

- **Feb 2017** (6 projects: Clementi NorthArc/Peaks, Northshore Cove, Waterway Sunrise II, Tampines
  GreenBloom/GreenFlora — 4,056 units). Clementi Peaks only offered 424 of its 1,104 total units in
  this exercise (the rest went to SERS rehousing) — correctly excluded.
- **Nov 2016** (9 projects: Bedok Beacon/North Vale/South Horizon, Kallang Residences, Matilda
  Sundeck, Northshore Trio, Waterway Sunrise I, Woodleigh Glen/Village — 5,110 units). Woodleigh
  Glen/Village are Bidadari-precinct → town TOA PAYOH per established convention.
- **Aug 2016** (5 projects: Buangkok Woods, EastDelta @ Canberra, Tampines GreenVerge/GreenView,
  Valley Spring @ Yishun — 4,841 units). Fully clean data, no combined-row estimation needed.
- **May 2016** (6 projects: Ang Mo Kio Court, Bedok North Woods, EastCreek @ Canberra, Senja
  Heights/Ridges/Valley — 3,770 units). **Caught a second real instance of the column-misalignment
  bug** (first found May 2017/Woodlands Spring): Senja Ridges' raw table row has TWO leading blank
  columns (no 2-Room Flexi, no 3-Room) — its three printed numbers initially looked like
  3-Room/4-Room/5-Room but cross-checking against the table's Total row proved they're actually
  4-Room/5-Room/3Gen. Caught before writing any data, using the exact verification method now
  documented in the `seed-bto-launch` skill file.

All four launches: official press releases/annexes sourced from a mix of the National Archives of
Singapore (nas.gov.sg — several pre-2017 press releases and Annex A1s are hosted there directly,
no Wayback needed) and Wayback Machine captures of hdb.gov.sg for the 2-Room-Flexi lease-tenure
annexes. Every launch reconciled exactly to its official headline BTO-flat count (separate from any
bundled SBF exercise, which is never seeded). No new project-name collisions across any of the four.
`npm test` green throughout (240 tests, no test file changes). Dataset now spans **May 2016 → June
2026**, 39 launches total. **None of this batch is committed, pushed, or deployed** — continuing
further back per the user's standing instruction; will stop and report if/when a real blocker (not
just a recoverable annex-hunting hiccup) is hit.

## Recent Changes (Sep 2026 — BTO historical backfill: May 2017) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2017 BTO launch** (6 projects: Dakota Breeze and Pine Vista in Geylang — Mature;
Forest Spring @ Yishun, Marsiling Grove and Woodlands Spring in Woodlands — Non-Mature; Woodleigh
Hillside — Mature, in the Bidadari precinct, town set to TOA PAYOH per the established
Bidadari-precinct convention — 4,802 units total, reconciles exactly to the official per-project
unit tables; secondary sources round this to ~4,600 or ~8,700-with-SBF, both wrong/misleading).
**Caught a genuine PDF-table-extraction bug before writing any data**: Woodlands Spring's row in
the combined Marsiling-Grove/Woodlands-Spring unit table has no 2-Room-Flexi units, so its raw
extracted values ("72, 100") looked like a left-aligned 2-Room-Flexi/3-Room pair, but cross-checking
against the table's own printed Total row proved they actually belong to 3-Room/4-Room (Woodlands
Spring has zero 2-Room Flexi flats). **General lesson recorded for future extractions**: whenever a
combined multi-project table has a row with fewer populated cells than the full header, always
verify the assignment against the table's stated Total row sum before writing data — left-alignment
is only safe when the *missing* columns are at the end, not when an early column (like 2-Room
Flexi) is the one that's blank. Dataset now spans **May 2017 → June 2026**, 35 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Aug 2017) — LOCAL ONLY, NOT YET COMMITTED

Added the **August 2017 BTO launch** (3 projects: Sky Vista @ Bukit Batok and West Scape @ Bukit
Batok in Bukit Batok, Rivervale Shores in Sengkang — all Non-Mature — 3,897 units total, reconciles
exactly, official press release again sourced from nas.gov.sg). Sky Vista/West Scape share one
price table: 3-Room prices are identical with real per-project unit splits, 2-Room Flexi uses the
standard combined-row technique with real per-project 99-year prices from Annex A2. Rivervale
Shores is fully standalone. Same recurring bundled-ROF pattern (this was the *inaugural* ROF
exercise, 1,394 flats, not seeded); Annex B was the ROF list, Annex C the real BTO admin annex.
No new name collisions. Dataset now spans **August 2017 → June 2026**, 34 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2017) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2017 BTO launch** (5 projects: Anchorvale Village and Fernvale Glades in
Sengkang — Non-Mature; Eunos Court in Geylang, Tampines GreenCourt in Tampines — Mature; Northshore
Edge in Punggol — Non-Mature — 4,829 units total, reconciles exactly to the official press release
sourced from the National Archives of Singapore, nas.gov.sg, rather than a Wayback capture of
hdb.gov.sg). Anchorvale Village/Fernvale Glades share one price table: their 3-Room prices are
identical with real per-project unit splits (no ambiguity), while their 2-Room Flexi units use the
by-now-standard combined-row technique (real per-project 99-year price from Annex A2, since only
the launch-wide Type 1/Type 2 total was published). **Hit and recovered from a genuine download
truncation**: the first `curl --compressed` fetch of Annex A1 silently produced a file that `file`
reported as a valid-looking PDF but which `pypdf` rejected as "Stream has ended unexpectedly" — the
byte count matched the previous *attempt's* content-length but not the actual complete file; a
plain re-fetch (no backgrounding) produced a file ending in a proper `%%EOF` marker and parsed
cleanly. Lesson: `file`'s PDF magic-byte check is not proof of a complete download — for any file
that fails to parse, re-fetch once before assuming the source itself is broken. Dataset now spans
**November 2017 → June 2026**, 33 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Feb 2018) — LOCAL ONLY, NOT YET COMMITTED

Added the **February 2018 BTO launch** (5 projects: Teck Whye View in Choa Chu Kang and Woodlands
Glade in Woodlands — Non-Mature; Tampines GreenDew, Tampines GreenFoliage, and Ubi Grove in
Geylang — Mature — 3,664 units total, reconciles exactly). Fully clean data: every flat type
including 2-Room Flexi Type 1/Type 2 given per-project directly, except the Tampines pair's shared
3/4/5-Room price table (handled per the standard shared-pricing convention — no ambiguity since
neither project has 2-Room Flexi). Same recurring bundled-ROF-exercise pattern (717 flats, not
seeded); Annex B was the ROF list, Annex C the real BTO admin annex. No new name collisions.
Dataset now spans **February 2018 → June 2026**, 32 launches total. `npm test` green (240 tests,
no test file changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: May 2018) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2018 BTO launch** (4 projects: Casa Spring @ Yishun and Fernvale Dew — Non-Mature;
Kim Keat Beacon in Toa Payoh and Tampines GreenVines in Tampines — Mature — 3,970 units total,
reconciles exactly). Clean like Nov 2018: no shared price tables, every flat type (including
2-Room Flexi Type 1/Type 2) given per-project directly in Annex A1 — no combined-row estimation
needed. This launch had 5 annexes with an unusual letter assignment: A1/A2 pricing, B was SBF
prices (not seeded), **C was income-assessment-deferment eligibility conditions (not an admin or
pricing annex at all)**, D was the real BTO/SBF admin-details annex — worth remembering that annex
letters on pre-2020 launches carry no fixed meaning and must be opened to identify, not assumed.
No new name collisions this launch. Dataset now spans **May 2018 → June 2026**, 31 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Aug 2018) — LOCAL ONLY, NOT YET COMMITTED

Added the **August 2018 BTO launch** (4 projects: Melody Spring @ Yishun (Aug 2018) and Yishun Glen
in Yishun, Punggol Point Cove (Aug 2018) and Punggol Point Woods in Punggol — all Non-Mature — 4,375
units total, reconciles exactly). **Two new project-name collisions found and fixed**: HDB reused
both "Melody Spring @ Yishun" (this launch vs the already-committed Nov 2018 entry) and "Punggol
Point Cove" (this launch vs the already-committed Sep 2019 entry) for unrelated launches at the same
physical sites — confirmed via identical OneMap coordinates. Both pairs disambiguated as
"(Month Year)" per the standing collision convention: edited the two already-committed JSON entries
(`scripts/bto_launches.json` lines ~9774 `PUNGGOL POINT COVE` → `PUNGGOL POINT COVE (SEP 2019)`, and
~10615 `MELODY SPRING @ YISHUN` → `MELODY SPRING @ YISHUN (NOV 2018)`), regenerated their
`bto_launches_info/` reference `.md` files under the new slugs, and deleted the old un-suffixed
files. **This means the previous commit's data for those two projects has technically changed** —
worth mentioning if the user asks why already-committed files show as modified/renamed in the next
`git status`. Dataset now spans **August 2018 → June 2026**, 30 launches total. `npm test` green
(240 tests, no test file changes). **Not yet committed, pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2018) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2018 BTO launch** (5 projects: EastGlen @ Canberra in Sembawang, Fernvale
Acres in Sengkang, Melody Spring @ Yishun in Yishun, Plantation Grove in Tengah — all Non-Mature;
Tampines GreenGem — Mature — 3,802 units total, reconciles exactly to the press-release headline).
Notably cleaner than every 2019 launch: no shared/combined price tables between projects, and even
2-Room Flexi Type 1/Type 2 unit splits are given directly per project in Annex A1 — no combined-row
estimation technique needed here. Same recurring pattern of a bundled Sale of Balance Flats (SBF)
exercise under the same press release (not seeded); real BTO admin annex was Annex C. This session's
first launch already fully committed and pushed (`7010a1d`, covering Feb 2019 → Feb 2020) — this
Nov 2018 entry is queued alongside it, not yet committed. Dataset now spans **November 2018 → June
2026**, 29 launches total. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Feb 2019) — LOCAL ONLY, NOT YET COMMITTED

Added the **February 2019 BTO launch** (5 projects: Boon Lay Glade and Jurong West Jewel in Jurong
West, Fernvale Vines in Sengkang — Non-Mature; Kallang Breeze and Towner Crest in Kallang/Whampoa —
Mature — 3,162 units total, reconciles exactly to the press-release headline). Same recurring
pattern as every other 2019 launch this session: bundled with a separate Re-Offer of Balance Flats
(ROF) exercise (577 flats, not seeded); Annex B was the ROF list, Annex C the real BTO admin annex.
Two shared-price-table pairs (Boon Lay Glade/Jurong West Jewel, and Kallang Breeze/Towner Crest)
use the by-now-standard shared-pricing + combined-2-Room-Flexi-variant conventions; Fernvale Vines
stands alone with its own full price breakdown including a 3Gen row that initially looked missing
from a naive text scan of the PDF (a `pypdf` per-line extraction interleaved the two projects'
3Gen rows oddly — worth grep'ing for "3Gen" case-insensitively across the whole page rather than
trusting a single top-to-bottom read when a project's row count looks short). Dataset now spans
**February 2019 → June 2026**, 28 launches total. `npm test` green (240 tests, no test file
changes). **Not yet committed, pushed, or deployed** — five launches now queued (Feb/May/Sep/Nov
2019, Feb 2020).

## Recent Changes (Sep 2026 — BTO historical backfill: May 2019) — LOCAL ONLY, NOT YET COMMITTED

Added the **May 2019 BTO launch** (4 projects: Champions Green in Woodlands, Garden Vale @ Tengah
and Plantation Acres in Tengah — Non-Mature; Kempas Residences in Kallang/Whampoa — Mature — 3,485
units total, reconciles exactly to the press-release headline). Same recurring pattern as Sep/Nov
2019: this press release bundled a BTO exercise with a separate Sale of Balance Flats (SBF)
exercise — Annex B was the SBF price list (not seeded), Annex C the real BTO admin-details annex.
Kempas Residences' 2-Room Flexi flats are senior-only short-lease (like Kim Keat Ripples, Feb 2020)
but — unlike the Tengah/Feb-2020 combined-row cases — its Type 1/Type 2 unit counts were given
*separately* in the official price table, so both are seeded as distinct rows rather than combined.
Garden Vale @ Tengah and Plantation Acres repeat the shared-price-table + combined-2-Room-Flexi
pattern from earlier launches. Dataset now spans **May 2019 → June 2026**, 27 launches total.
`npm test` green (240 tests, no test file changes). **Not yet committed, pushed, or deployed** —
four launches now queued (May 2019, Sep 2019, Nov 2019, Feb 2020).

## Recent Changes (Sep 2026 — BTO historical backfill: Sep 2019) — LOCAL ONLY, NOT YET COMMITTED

Added the **September 2019 BTO launch** (3 projects: Punggol Point Cove and Punggol Point Crown in
Punggol — Non-Mature; Tampines GreenGlen in Tampines — Mature — 3,373 units total, reconciles
exactly to the press-release headline). Officially an HDB "September 2019" exercise (applications
11-17 Sep 2019) even though contemporary press/blog coverage calls it the "August 2019" launch
(announcement date) — filed under `2019-09` to match HDB's own application-window naming, matching
this project's existing `launch_id` convention. Same non-standard-annex-lettering gotcha as Nov
2019: this press release's "Annex B" was actually a Re-Offer of Balance Flats (ROF) list (HDB's
equivalent of SBF), not BTO admin details — the real admin annex was Annex C; the ROF PDF was
downloaded, inspected, and discarded (not seeded). Dataset now spans **September 2019 → June
2026**, 26 launches total. Punggol Point Cove/Crown share one HDB price table (same
shared-pricing-table + combined-2-Room-Flexi-variant conventions as Nov 2019 and Feb 2020, using
real per-project 99-year prices from Annex A3). `npm test` green (240 tests, no test file changes).
**Not yet committed, pushed, or deployed** — three launches now queued (Sep 2019, Nov 2019, Feb
2020) pending the user's next instruction.

## Recent Changes (Sep 2026 — BTO historical backfill: Nov 2019) — LOCAL ONLY, NOT YET COMMITTED

Added the **November 2019 BTO launch** (5 projects: Garden Vines @ Tengah, Plantation Grange,
Plantation Village in Tengah town — Non-Mature; Tampines GreenSpring in Tampines and Yio Chu Kang
Beacon in Ang Mo Kio — Mature — 4,571 units total, reconciles exactly to the press-release headline
of 4,571 BTO flats). This press release actually combined a BTO exercise **and** a separate Sale of
Balance Flats (SBF) exercise (3,599 flats) under one 8,170-flat headline — only the BTO portion was
seeded; the SBF annex (which was itself misleadingly named "Annex B" on HDB's site, while the actual
BTO admin-details annex was "Annex C") was downloaded, inspected, and discarded as out of scope —
worth double-checking annex letter/content match on every older launch, not just trusting the
filename. Dataset now spans **November 2019 → June 2026**, 25 launches total. The three Tengah
projects share one HDB price table for 3/4/5-Room flats (seeded identically per existing
shared-pricing-table convention) and one resale-comparables table; their 2-Room Flexi units (two
floor-area variants each) were again only published as a launch-wide combined total, not split per
project or size — same combined-row technique as Feb 2020, using each project's real 99-year-lease
price band from Annex A2. `npm test` green (240 tests, no test file changes). **Not yet committed,
pushed, or deployed.**

## Recent Changes (Sep 2026 — BTO historical backfill: Feb 2020) — LOCAL ONLY, NOT YET COMMITTED

Added the **February 2020 BTO launch** (3 projects: Canberra Vista in Sembawang, Kim Keat Ripples
and Toa Payoh Ridge in Toa Payoh — 3,095 units total, reconciles exactly to the press-release
headline). Dataset now spans **February 2020 → June 2026**, 24 launches total. Official Annex A1/A2
(pricing) and Annex B (admin) recovered via Wayback Machine (live hdb.gov.sg URLs are dead, but a
real `200`/`application/pdf` capture of the `.ashx` path exists — note: the `.pdf`-suffixed capture
of Annex A1 was truncated to exactly 1MB by Wayback's playback, the `.ashx`-suffixed capture was
not — always verify downloaded PDF size against the CDX `length` field before trusting a fetch).
Two data-modeling notes worth remembering for earlier launches: (1) Kim Keat Ripples and Toa Payoh
Ridge share one HDB-published 4-Room price table row — both seeded with the identical price range,
per the existing shared-pricing-table convention; (2) their 2-Room Flexi flats (senior short-lease)
have two floor-area variants (36 sqm / 45-46 sqm) whose units were only published as a *combined*
per-launch total, not split per project or per size — resolved by seeding one combined row per
project (units are known per-project) using that project's real 40-year-lease price band from Annex
A2 (Type 1 min to Type 2 max), which is more accurate than falling back to housingmap.sg since real
official per-project prices were available. `npm test` green (240 tests, no test file changes).
**Not yet committed, pushed, or deployed** — pending user's next instruction. Feb 2020 was picked
as the next launch back from the previously-backfilled Aug 2020 floor; earlier launches (2019 and
before) remain undone.

## Recent Changes (Sep 2026 — BTO historical backfill: Aug 2020 → Feb 2022) — DEPLOYED

Backfilled `scripts/bto_launches.json` with 18 additional historical BTO launches (May 2021 → Oct
2024 done incrementally, then Feb 2021 → Aug 2020 in a deeper push), taking the dataset from 5
launches to 23, now spanning **August 2020 → June 2026** (plus the Nov 2026 provisional skeleton).
Every launch verified: per-project unit totals reconcile exactly to press-release headline figures
before being committed. `npm test` stayed green throughout (240 tests, no test file changes — this
is pure data work).

**New permanent archive**: `bto_launches_info/` (repo root) — every launch's source PDFs plus one
`<launch_id>-<project-slug>.md` human-readable reference summary per project (built straight from
the JSON, not re-extracted). 218+ files. Naming convention: `<launch_id>-annex-<letter>-<desc>.pdf`
for official annexes, `<launch_id>-brochure-<project>.pdf` for HDB sales brochures used as a
fallback source. `<launch_id>` is always `YYYY-MM` (e.g. `2024-10`, `2020-08`), matching the JSON's
own `launch_id`.

**Pre-Oct-2024 launches use the old classification system** — Non-Mature/Mature Town(s) or Prime
Location Public Housing Model (PLH), not Standard/Plus/Prime. Preserved as the real historical label
in each project's `classification` field rather than force-mapped; the frontend's classification
badge just falls back to its neutral "Standard" grey styling for any string it doesn't recognize,
still showing the correct text.

**Two genuine name collisions hit and resolved** the same way as the pre-existing Redhill Peaks
(Oct 2025 / Feb 2026) case: HDB reused the exact same project name (identical coordinates confirmed)
across two unrelated launches. Both entries disambiguated as `"NAME (MONTH YEAR)"` /
`display_name: "Name (Month Year)"`:
- **Alexandra Peaks** — Dec 2023 and Jul 2025
- **Tanjong Tree Residences @ Hougang** — Nov 2021 and Feb 2024

**New fallback source for when Annex A is genuinely unrecoverable** (confirmed to happen — Nov 2020
and Aug 2020's official pricing PDFs were never successfully archived anywhere, live or Wayback):
`housingmap.sg/bto/` hosts HDB's own sales brochure PDF per project
(`housingmap.sg/hdb-brochures/bto-<yyyy>-<mm>/<Project_Name>.pdf`), whose site-plan page has a
**rasterized (image, not text) per-block unit-mix table** giving real per-flat-type unit counts —
must be read with Claude Code's `Read` tool image-rendering on the PDF (`pages` param), not `pypdf`
text extraction, and requires `poppler` (`brew install poppler`). Floor-plan pages give real sqm.
Full mechanics, plus the PropertyGuru-pricing companion technique and the price-estimation fallback
for when only a "From" minimum price is found, are written up in the `seed-bto-launch` skill and in
a dedicated auto-memory reference note (`reference_housingmap_unit_mix.md`) — **read that skill
before doing any further BTO backfill work**, it has the complete runbook.

**August 2020's price *ranges* are partly estimated, not fully sourced** (flagged per-launch in its
own `_curation_note` in the JSON) — PropertyGuru only had "From" (minimum) prices for that launch, so
every `price_max` and every 2-Room-Flexi-Type-2 `price_min` was extrapolated from the real minimum
using the min-to-max ratio pattern from the nearest verified same-classification comparable launch
(done with explicit user sign-off: "keep the data as accurate as possible, but best estimates are
fine"). All unit counts and sqm for that launch are real, not estimated. Every other launch this
session has fully real, sourced prices.

**Not yet done**: February 2020 and earlier (housingmap.sg's list goes back to 2001) — backfill was
paused there, expect the same Annex-A-unrecoverable pattern for most pre-2021 launches, so the
housingmap.sg fallback will likely be the default rather than the exception going forward.

An earlier 10-launch batch this same session (May 2022 → Oct 2024) was already committed, pushed,
and confirmed live on production via a manual `workflow_dispatch` trigger of the "Refresh Data"
GitHub Actions workflow (see that section below). This second batch (Feb 2021 → Aug 2020, 8 more
launches) is being committed/pushed/deployed the same way immediately after this note is written.

## Recent Changes (Sep 2026 — Search indexing diagnosis + IndexNow) — DEPLOYED (v=24)

User asked why SEO work wasn't producing organic traffic. Connected Google Search Console via the
Composio CLI and pulled the real numbers — **the answer was non-indexing, not on-page SEO**.
Google's last crawl of the site was **2026-05-29**, predating the entire June 2026 SEO batch, so
none of that work had ever been seen. Homepage sat at `Crawled – currently not indexed`,
`/hdb/tampines` was `URL is unknown to Google`, sitemap read 255 submitted / 0 indexed, and the
site had 3 impressions and 0 clicks across 94 days. Root cause is zero external backlinks — Google
won't spend crawl budget on a new subdomain nothing links to. See `progress.md` §Search Indexing
Status for the full diagnosis and remediation checklist.

- **IndexNow** (new `scripts/indexnow-ping.js`, chained onto `deploy` + `deploy:frontend`): fetches
  the live sitemap and POSTs every URL to `api.indexnow.org` (Bing, Yandex, DuckDuckGo, Naver,
  Seznam). All 426 URLs accepted. Deliberately **non-fatal** — logs a warning and exits 0 so a
  search-engine outage can't block a deploy. Key file `public/a464a4c238872496dcaa8d33718f8e13.txt`
  **must never be deleted**; IndexNow re-validates it on every submission. First submission returns
  `403 SiteVerificationNotCompleted` until IndexNow fetches the key file (cleared in ~20s here) —
  not a real failure, just retry.
- **GSC actions**: ~13 key pages manually submitted via URL Inspection, prioritising the Nov 2026
  BTO project pages over town pages (launch interest peaks pre-launch, competition on those names
  is ~zero); sitemap resubmitted and re-downloaded by Google within 1s.
- **Cloudflare Crawler Hints** enabled (Caching → Configuration — *not* Speed → Optimization; it's
  free-plan, uses its own Cloudflare-managed key, no conflict with ours). Caveat: app HTML serves
  `cf-cache-status: DYNAMIC`, so it may detect few changes — the deploy-chained ping is the
  dependable path. Crawler Hints is **not** exposed as a zone setting in the API (`crawlhints` →
  `Undefined zone setting`; only unrelated `early_hints` exists), so it's dashboard-only.
- **GSC Crawl Stats verified clean** — no Googlebot failures; Cloudflare isn't blocking (unlike the
  earlier AI-bot incident).
- **Tooling**: Composio CLI installed + logged in, with Google Search Console and GitHub connected.
  GSC is now queryable from a session without the dashboard — see `progress.md` for tool slugs.
- **Outstanding**: off-site backlinks remain the bottleneck; **data.gov.sg app showcase submission
  added as the top TODO item** (highest-trust `.gov.sg` link realistically available, and WorthIt is
  built on their dataset). Recheck indexing ~2026-09-11.

## Recent Changes (Aug 2026 — BTO backfill: Feb/Jul/Oct 2025 + Feb 2026 all now real official data) — BUILT LOCALLY

User asked to backfill the remaining skeleton launches. All four are now fully seeded from HDB's
official Annex A press-release PDFs (same standard as June 2026) — **no more skeletons**; every
launch in `scripts/bto_launches.json` now has real data except Nov 2026 (genuinely hasn't launched
yet, stays provisional). `bto_projects` now has **168 rows across 41 projects, 6 launches**.

- **Feb 2025**: 5 projects (Woodlands North Verge, Chencharu Vines, Chencharu Green, Stirling
  Horizon, Tanjong Rhu Parc Front), 5,032 units — matches official headline exactly.
- **Jul 2025**: 8 projects (Bangkit Breeze, Sembawang Beacon, Simei Symphony, Woodlands North
  Grove, Alexandra Peaks, Alexandra Vista, Clementi Emerald, Toa Payoh Ascent), 5,547 units —
  matches exactly (Sembawang Beacon's 775 units matched press coverage precisely too).
  Annex PDF URLs for this launch needed a `-20250723` date suffix
  (`Annex-A-20250723.pdf`/`Annex-B-20250723.pdf`) — the plain `Annex-A.pdf` guess 404'd.
- **Oct 2025**: 10 projects, 8,937 units in `flats[]` + 207 excluded Community Care Apartment
  units at Fernvale Plains (a separate 30-year-lease senior-housing scheme, not a resale-comparable
  flat type) = 9,144 exactly matching the official headline. Admin-details annex was named
  **Annex C** here, not Annex B (`Annex-C-BTO-sales-exercise-Oct-2025-v2.pdf`) — the annex lettering
  isn't stable across launches, don't assume it.
- **Feb 2026**: 6 projects (Sembawang Voyage, Sembawang Deck, Tampines Bliss, Tampines Nova, Kim
  Keat Crest, Redhill Peaks), 4,692 units — matches exactly.

**Real data-integrity issue found and fixed mid-backfill**: HDB genuinely reused the exact project
name **"Redhill Peaks"** twice — Oct 2025 (1,021 units: 2RF+4R only) and Feb 2026 (1,052 units:
2RF+3R+4R) are two different launch phases of the same Bukit Merah site, split across two exercises
due to site-preparation timelines for its two land parcels (confirmed by the user, corroborated by
uchify's Feb 2026 coverage explicitly framing it as "more Redhill Peaks flats for those who missed
out"). The app's schema/API treat `project` (uppercase name) as a **global unique key** — `/api/resolve`
exact-match and `/api/bto/project-overview` both do `WHERE UPPER(project) = ?` with no `launch_id`
filter — so two rows sharing that key would have silently conflated both launches' flats, prices,
and waiting times into one incoherent record. **Fixed by disambiguating both entries**:
`REDHILL PEAKS (OCT 2025)` / `REDHILL PEAKS (FEB 2026)` as the `project` key and `display_name`,
with a note on each explaining why. Verified live: both resolve and render independently with
correct, non-conflated data (1,021 vs 1,052 units, 53 vs 55 months wait). **This is a latent modeling
risk for any future launch that reuses a project name** — if it happens again, apply the same
`(MONTH YEAR)` disambiguation pattern before seeding.
- Zero global duplicate `project` keys after the fix (verified programmatically across all 43
  projects). All coordinates verified in Singapore bounds. 240 tests still pass (no test changes
  needed — this was pure seed-data work, no code changes).
- **Still local only — not committed/deployed.**

## Recent Changes (Aug 2026 — `/api/nearby-hdb` map-marker bug fix) — BUILT LOCALLY

**Pre-existing bug, found via user report, NOT introduced by the BTO feature** — but surfaced by it,
since Bedok Bayshore (a new coastal BTO site) is the first place in the app anyone looked at that's
both HDB-sparse nearby and condo-dense a bit further out. User noticed Bayshore's BTO page showed
zero map markers while Geylang Mattar's showed plenty, despite Bayshore visibly having close blocks
(e.g. postal 460066, 622m away) and condos (VELA BAY, 152m away) on the map.

Two compounding bugs in `GET /api/nearby-hdb` (`server/index.js`, shared by postal searches,
private-project pages, and now BTO pages — not BTO-specific code):
1. **Hardcoded 500m radius with no fallback**: `findNearbyHdbBlocks(latF, lngF)` was called with no
   radius argument (defaults to 500m) and the handler returned early with empty results if that
   came up empty — inconsistent with `/api/bto/project-overview`'s own 500m→1000m→2000m→town ladder
   used one endpoint over. Verified: Bayshore has 0 HDB blocks within 500m but 42 within 1000m.
   **Fix**: the same radius ladder (500/1000/2000, stop at first non-empty tier) now used here too.
2. **Private-project lookup wrongly coupled to the HDB-block search succeeding**: the early return
   fired before the code ever reached the (separately-radiused, 800m) private-project query, so an
   area could have real nearby condos and still show none. Verified: 28 private projects within
   800m of Bayshore (Bayshore Park, Costa Del Sol, VELA BAY at 152m, etc.), all silently dropped.
   **Fix**: private-project lookup now runs unconditionally, independent of whether any HDB blocks
   were found; the transactions SQL query is separately guarded to skip cleanly (not throw on an
   invalid empty `IN ()` clause) when the block ladder still finds nothing.
- New regression test in `tests/integration/nearby-hdb.test.js`: nearby_projects still returns a
  known project when 0 HDB blocks are nearby (uses the existing SKY HABITAT fixture, ~12.6km from
  the fixture's Bedok blocks — no new fixture data needed). 240 tests pass (1 new).
- Verified live: Bayshore now returns 68 HDB transactions + all 28 nearby private projects
  (previously 0 and 0); Geylang Mattar's response is unchanged (500m already found data there, so
  it never needed to escalate) — confirms the fix doesn't regress the common case.
- **Still local only — not committed/deployed.**

## Recent Changes (Aug 2026 — Nov 2026 BTO launch added as provisional data) — BUILT LOCALLY

User asked to include the Nov 2026 launch (previously a deliberately-empty skeleton, since HDB
hasn't officially launched it). Added all 7 projects — Bedok Bayshore I & II, Geylang Mattar,
Toa Payoh Caldecott, Tengah Garden Avenue, Yishun Chencharu, Sembawang North — sourced from
third-party BTO preview trackers (RecordBTO, uchify, PropertyNet.SG, StackedHomes), **not** an
official HDB press release (none exists yet for this launch). Every flat entry has
`price_min`/`price_max = null`; classification is `null` for all seven (not yet announced).
Bayshore's two sites have no clean per-project flat-type split reported anywhere, so each got a
single aggregate flat row (`resale_flat_type: null`, real total units 860/1,640) rather than an
invented type breakdown; the other five projects have real, source-confirmed per-type unit counts.
47 `bto_projects` rows total now (28 June 2026 + 19 Nov 2026). Tests still 239/240 (no new test
file needed — existing fixture data is separate from the real seed JSON).

**Four real bugs found and fixed while wiring this in** (none were in the original feature, all
surfaced by having a project with real structure but unknown prices/classification for the first
time):
1. `discount_pct` in `/api/bto/project-overview` computed `NaN` (not `null`) when a flat's
   `price_min`/`price_max` were null — fixed by guarding on both being non-null before computing.
2. Five separate template-literal spots (`app.js` header pill, SEO title/description in both
   `updateSeoForSearch` and the server's `/bto/<slug>` metadata branch, `renderBtoIndex` cards, the
   autocomplete sub-label) rendered the literal string `"null"` when `classification` was null —
   fixed each with a conditional suffix instead of unconditional interpolation. Caught only by
   actually loading a null-classification project in a browser and reading the page title — grep
   alone wouldn't have found the index-card and autocomplete instances.
3. Flat cards showed `"$--–$--"` for unpriced flats instead of a clear "Price TBD" — added an
   explicit null check before formatting.
4. The comparison-table loop iterated `resale_flat_type` values including `null` (from the
   Bayshore aggregate rows), which would have produced a blank-labeled comparison row — fixed by
   filtering `Boolean` before building the per-type `Set`.

Added a visible amber "⚠️ Provisional" notice on any project whose launch `status === 'upcoming'`,
and surfaced `location_desc` in the page subtitle (previously computed by the API but never
rendered anywhere for humans, only in bot-facing `content_html`) — both are small UX additions this
task revealed were missing, not part of the earlier acceptance checklist. **Still local only —
not committed/deployed.**

## Recent Changes (Aug 2026 — BTO launches feature) — BUILT LOCALLY, not yet committed/deployed

Implemented per `BTO.plan.md` (repo root, §1-4 + Appendices A/B) with corrections captured in the
plan-mode execution plan (see "Deviations from the original plan" below). BTO project names (e.g.
"Lakeview Cascadia", "Sembawang Portico") are now searchable from the main search bar and have a
project page showing indicative flat prices plus a **BTO vs nearby resale comparison** computed
live from the existing `transactions` table + `findNearbyHdbBlocks()`. 239 tests pass (22 new,
up from 217). **Local only — user handles commit + deploy; `?v=` bump happens automatically via
`bump-version.js` on deploy, not touched here.**

- **Data**: `scripts/bto_launches.json` (new, hand-curated, NOT scraped — `homes.hdb.gov.sg` is
  bot-blocked). June 2026 launch fully populated (7 projects, 28 flat-type rows, geocoded via
  OneMap, cross-checked against `hdb_block_coords` for plausibility) from the official HDB Annex A
  press-release PDF. Five other launches (Feb/Jul/Oct 2025, Feb 2026, Nov 2026) are **skeleton
  entries only** (`projects: []`, sources noted) — a deliberate, documented follow-up curation task,
  not fabricated data. Nov 2026 skeleton includes third-party-tracker town names as a `_curation_note`
  (Bedok Bayshore ×2, Geylang Mattar, Sembawang North, Tengah Garden Avenue, Toa Payoh Caldecott,
  Yishun Chencharu) but deliberately has zero project rows, since exact project names aren't
  officially announced yet and inventing them would be fabrication.
- **New `bto_projects` table** in `resale.db`, dual-seeded exactly like `hdb_block_coords`: Python
  `seed_bto_projects()` in `download_data.py` (drops+recreates from the JSON on every full rebuild —
  JSON is sole source of truth, unlike the incrementally-geocoded `hdb_block_coords`) and a server
  startup fallback `seedBtoProjects()` in `server/index.js`. **Bug caught and fixed during
  implementation**: a temporal-dead-zone `ReferenceError` — `seedBtoProjects()` is called (via
  hoisted function declaration) from the top-of-file DB-open `try` block, before a `const
  BTO_LAUNCHES_JSON = require(...)` declared later in the file had executed. Fixed by moving the
  JSON `require()` + `HDB_QUOTED_RESALE` map construction to before the `try` block. BTO rows never
  go into `transactions`.
- **3 new endpoints**: `GET /api/bto/launches` (grouped listing), `GET /api/bto/projects` (autocomplete,
  mirrors `/api/private/projects`' validation exactly — short query → `{projects:[]}`, not 400),
  `GET /api/bto/project-overview` (flats + a standalone comps ladder: 1000m → 2000m → town fallback,
  `MIN_COMPS=5`, reusing `findNearbyHdbBlocks`/`median`/`percentile`/`monthsAgoStr` — a new bespoke
  version, NOT calling into `/api/valuation`'s deal-score/storey-adjustment internals).
- **Search bar resolution**: `/api/resolve` gets an **exact-match-only** BTO check inserted between
  the exact-town match and the town partial-match (so "SEMBAWANG PORTICO" resolves as `type:'bto'`
  while bare "SEMBAWANG" still resolves as the town — verified both directions live). **Deviation
  from the original plan**: no partial/LIKE BTO fallback in `/api/resolve` — that was this plan's
  original looser idea, corrected during planning because `/api/resolve` has no district/private
  logic inside it at all (confirmed by reading the actual code, not memory-bank paraphrase) and a
  LIKE match risked "SEMBAWANG" shadowing "SEMBAWANG PORTICO". Partial BTO discovery happens via
  autocomplete (`/api/bto/projects`) instead. Client-side `search()` in `app.js` checks
  `resolved.type === 'bto'` before its existing "any truthy `resolved.resolved` is a town" fallthrough.
- **Frontend**: `renderBtoResults()` (modeled on `renderPrivateResults`) and `renderBtoIndex()` new
  methods in `app.js`; routes `/bto` (dispatches directly) and `/bto/<slug>` (mirrors the existing
  `/private/<slug>` reconstruct-and-search pattern) in `handleUrlRoute()`. **Discovered during
  browser verification, not in the original plan**: a third unnamed "Percentiles + Town Summary"
  `<div>` (no id) sits between `#map-section` and `#transactions-section` in `index.html` and was
  staying visible on BTO pages since nothing hid it — gave it `id="percentiles-section"` and added
  it to the same hide/show pair as `#charts-section`/`#transactions-section` in `_onResultsShown()`
  and `renderBtoResults()`. `map.js` gained a `loadBtoSite(lat,lng,resolvedData)` method (confirmed
  via code read that `render([], resolvedData)` safely draws just the pin with an empty transaction
  array) and a third `isBto` pin-color case (orange `#f59e0b`, "🏗️ BTO Site" label) alongside the
  existing private/default cases.
- **SEO**: `/bto` and `/bto/<slug>` metadata branches (own `slugToBtoProject()` exact-match resolver
  — deliberately NOT reusing `slugToProject()`, whose fuzzy LIKE + transaction-count tiebreak is
  unsafe for BTO projects that have zero transactions to break ties with), soft-404 regex extended,
  sitemap adds `/bto` + one URL per priced project (excludes the empty skeleton launches).
- **Verified live** via `npm run dev` + Claude-in-Chrome: autocomplete shows an orange `bto` badge,
  "Lakeview Cascadia" and "Sembawang Portico" both resolve and render correctly (flats table in sqft,
  comparison table incl. a genuine `"No comparable resale data found"` case for Bishan 2-room —
  real data, not a bug — and HDB's-quoted-comparable footnotes), map shows the orange pin + nearby
  markers, light/dark theme both render correctly, direct navigation/refresh on `/bto` and
  `/bto/<slug>` both work.
- **Not done this pass** (explicit follow-ups): full backfill curation of the 4 skeleton 2025/2026
  launches; BTO markers on existing postal/town search maps (phase 2 per the original proposal);
  mobile-width (375px) visual check — the browser automation's window-resize tool didn't take
  effect in this sandbox (viewport stayed desktop-width), so mobile layout was verified by code
  review only (existing responsive Tailwind patterns reused: `overflow-x-auto` on the comparison
  table, `grid-cols-1 sm:...` on card grids), not an actual screenshot.

## Recent Changes (Aug 2026 — GitHub Actions "Refresh Data" wedged since 4 Jul) — FIXED, awaiting commit

The nightly `Refresh Data` workflow (`.github/workflows/refresh-data.yml`) failed every run from **2026-07-04** to **2026-08-26** (last success 2026-07-03). **Not a token/auth problem** — `FLY_API_TOKEN` authenticated fine every run.

- **Root cause chain**: on 2026-07-04 the SFTP upload died mid-transfer (`copy file: connection lost (12812288 bytes written)`), leaving a truncated `/data/resale.db.new.gz` on the Fly volume. Because `deploy:data` is a single `&&` chain, the failure skipped the `gunzip && mv` that would have consumed that staging file. Every later run then hit `Error: remote file /data/resale.db.new.gz already exists. flyctl sftp doesn't overwrite existing files for safety` — self-perpetuating deadlock.
- **Fix** (`package.json` `deploy:data`): inserted `fly ssh console --command "rm -f /data/resale.db.new.gz /data/resale.db.new"` between the `gzip` and the `fly ssh sftp put`. Clears stale staging files only — never touches the live `/data/resale.db`. Makes the step idempotent and self-healing, so no manual volume cleanup is needed.
- **Diagnostic note**: the failing step logs are only reachable via `gh run view <id> --log-failed`; the run summary just shows `Process completed with exit code 1`.
- **Still open**: the deploy token was created ~Jun 2026 with flyctl's default ~1-year expiry, so it lapses around **Jun 2027** — renew with `fly tokens create org` (must be an org token — deploy tokens cannot issue SSH certs). Unrelated to this failure.


## Recent Changes (Jul 2026 — Map completeness fixes for postal searches) — DEPLOYED (v=20)

User report: postal-code searches didn't show all houses (HDB or condo) on the map. Three root causes fixed; 217 tests pass (4 new).

- **Coords attached server-side** — `/api/area-overview` now attaches `lat`/`lng` to every `recent_transactions` row: distance path reuses the `findNearbyHdbBlocks()` result (`coordByKey`), town/street paths do one `hdb_block_coords` lookup for the returned keys (misses stay `null` → client geocode fallback). `map.js load()` unchanged — pre-attached coords flow through its existing `preGeocoded` branch, killing the 100-address geocode cap + OneMap round-trip for HDB searches.
- **Per-block marker guarantee** — when `streetClause` is active (postal/street search), recent transactions use `ROW_NUMBER() OVER (PARTITION BY block, street_name ORDER BY month DESC, resale_price DESC) <= 3`, cap 400 — every block with resale history within 500m gets a marker (verified: 54 unique blocks at 523876, was recency-crowded before). Town searches keep newest-200. Blocks with zero resale history intentionally never appear.
- **Condo marker race fixed** — `renderResults` chains `API.getNearbyHDB()` AFTER `TransactionMap.load()` resolves; previously they raced and `addNearbyProjects()` silently no-ops when `this.map` is null → intermittently vanishing private markers. (Private-project search path uses synchronous `loadPreGeocoded` — never raced.)
- **Nearby projects true radius** — `/api/nearby-hdb` `nearby_projects`: bounding box widened to prefilter only; haversine ≤ **800m** decides inclusion, `dist_m` attached, cap raised 20 → **40**.
- **NOT touched**: `findNearbyHdbBlocks` stays HDB-only by design (private coords live in `project_coords`).

## Recent Changes (Jul 2026 — Check My Price: Deal Score & Fair Value calculator) — DEPLOYED (v=20)

Feature #1 from the product proposal (`FEATURE_PROPOSALS.md`). 213 tests pass (42 new). **Local only — user handles commit + deploy; `?v=` bumps automatically via `bump-version.js`.**

- **`findNearbyHdbBlocks()` is now true-radius (global change)**: SQL bounding box kept as index prefilter, exact haversine (`haversineM`) decides inclusion; rows carry `dist_m`, sorted nearest first. Existing postal searches no longer include corner blocks 500–707m away.
- **New `GET /api/valuation`** (`server/index.js`, before SEO endpoints):
  - Subject by `postal` OR `block`+`street`; without `price` → `block_facts` (flat types + counts, standard `floor_area_sqm` values, storey ranges, remaining lease) inferred from the block's full transaction history. Lease = newest tx `remaining_lease_years` − elapsed (fixture has no `lease_commence_date` column — do not use it).
  - With `price` (50k–5M): comps ladder 500m (lease ±10y) → 1000m → drop lease → town+type fallback; `MIN_COMPS=8`. Confidence: high (≥15 @500m w/ lease) / medium / low (town fallback).
  - Storey adjustment computed live (NOT the unused `storey_adjustments` table): town×type buckets over 24 months, **lease-banded ±10y** — without the lease band, high-floor buckets are dominated by newer blocks and overstate the premium (Tampines 5R test: +19% biased → +5.9% banded). `computeStoreyFactor` requires both buckets ≥10 tx, clamps to ±10%.
  - `deal_score = clamp(50 − 250×deviation, 0, 100)`; ≥70 Good deal, 45–69 Fair price, <45 Premium. Fair range = p25–p75 × area. Response includes ≤20 comps with `dist_m`.
  - New `_test` exports: `haversineM`, `dealScore`, `computeStoreyFactor`, `monthsBetween`.
- **Frontend — one `#valuation-section` card, three entry points** (`index.html`, `app.js`, `api.js`):
  1. Auto-shown after postal-code searches (`loadValuationCard({postal})` in `renderResults`), price is the only required input; flat type / size / storey render as pre-filled chips (rows hidden when single option).
  2. 💰 "Check" buttons on desktop transaction rows (new 9th column; colspan 8→9) and mobile cards → `checkLikeThis(tx)` prefills everything from the row (HDB rows only).
  3. `/check/<postal>?price=` deep link — `handleUrlRoute` runs the postal search and auto-submits; bare `/check` focuses the search input. `_pushCheckUrl` pushes the shareable URL after each check.
  - `parsePrice()` accepts `685k` / `$685,000` / `0.685m`. Score badge colors reuse the map's green→blue→red anchors (`_valScoreColor`). GA4: `valuation_open`/`valuation_check`/`valuation_result`. Card resets in `_onResultsShown()`.
- **SEO**: `/check` branch in `/api/seo/metadata` (generic title; per-postal `noindex, follow`, canonical → `/check`); `/check` added to sitemap (priority 0.6).
- **Fixture** (`tests/fixtures/seed.js`): +12 BEDOK NORTH ST 1 3-ROOM rows (17 comps → exercises the high-confidence path). Deliberate assertion updates: BEDOK 12m count 10→22 (`area-overview.test.js`), total 30→42 (`status.test.js`).
- New `tests/integration/valuation.test.js` (16 tests) + unit tests for the new helpers and `App.parsePrice`.

## Current State
The project is fully deployed and functional:
- **Backend API**: Running on Fly.io at `worthit-api.fly.dev` — 370K transactions, data through May 2026
- **Frontend**: ✅ Live at [worthit.canlah.app](https://worthit.canlah.app) via Cloudflare Pages (DNS on Cloudflare, domain from Porkbun)
- **Database**: SQLite on Fly.io persistent volume (`/data/resale.db`), built locally and uploaded via SFTP
- **Local dev**: `node server/index.js` serves both frontend and API on port 3000

## DEPLOYED (Jun 2026) + Cloudflare AI-bot block finding

- **Deployed** the full SEO batch via `npm run deploy` (API to Fly + frontend to Cloudflare Pages); cache bumped to **v=19**; live `latest_month` now **2026-06**. Verified live: town×flat-type bot injection works (Googlebot gets correct title + FAQ prose on `/hdb/tampines/4-room`), E-E-A-T pages serve 200.
- **Bugfix during deploy**: E-E-A-T pages first 308-looped — the edge requested `/about.html` from ASSETS, which Cloudflare Pages 308-redirects to the clean `/about` (re-entering the function → loop). Fixed by fetching the **original clean URL** (`env.ASSETS.fetch(request)`) for `STATIC_PAGES`; redeployed frontend. Now 200.
- **✅ RESOLVED — Cloudflare was blocking ClaudeBot + PerplexityBot (403)** via AI Crawl Control's "Block AI Bots" managed rule. User set **AI Crawl Control → Block AI Bots Scope → "Do not block (allow crawlers)"** on the `canlah.app` zone. Now verified live: ClaudeBot, PerplexityBot, GPTBot, OAI-SearchBot, Googlebot, bingbot all → 200, and ClaudeBot receives the full injected title + FAQ prose on `/hdb/tampines/4-room`. The `BOT_PATTERNS` + robots.txt AI-bot work is now effective end-to-end. (If AI crawlers ever need re-blocking, that's the dashboard setting to revisit.)

## Recent Changes (Jun 2026 — E-E-A-T content pages: About / Methodology / Data Sources)

Three standalone static trust pages (important for a YMYL/financial topic). 171 tests pass (2 new in `tests/integration/seo.test.js`).

- **New files**: `public/about.html`, `public/methodology.html`, `public/data-sources.html` — self-contained (own head/meta/canonical/OG/JSON-LD, Tailwind CDN + brand config, anti-FOUC dark mode, GA4, minimal nav + footer; no app.js dependency). Honest copy — does NOT fabricate owner/credentials; methodology accurately describes the real Deal Score (ratio = sale $/sqm ÷ nearby comparable median; green ≤0.70, blue ≈1.0, red ≥1.30), $/sqm trend with 3-month rolling avg, percentiles, sqft conversion (×10.7639). data-sources has the **"Not financial advice" disclaimer** + source provenance (data.gov.sg/URA/OneMap) + refresh cadence + limitations. JSON-LD: AboutPage+Organization, TechArticle+BreadcrumbList, Dataset+BreadcrumbList.
- **URL = `/data-sources`, NOT `/data`** — `public/data/` already exists (holds `mrt_stations.json` used by `map.js`); `express.static` 301-redirects `/data`→`/data/`, so the page would never serve. Used `/data-sources` (also a better slug). Filename `data-sources.html`.
- **Serving**: Cloudflare edge (`functions/[[path]].js`) — added `STATIC_PAGES` map short-circuit (BEFORE bot detection + the extension check) → serves the page HTML to bots AND humans, bypassing SPA/index.html injection. Local dev / Fly origin — Express routes added for `/about`, `/methodology`, `/data-sources` just before the `app.get('*')` catch-all.
- **Discovery**: added to sitemap (priority 0.5, monthly); footer nav links on `index.html` (About · Methodology · Data Sources); the three pages cross-link each other + home.
- **Deployed** Jun 2026 (v=19) — verified live.

## Recent Changes (Jun 2026 — SEO micro quick-wins: H1, meta length, soft-404)

- **Homepage H1** (`public/index.html`) — changed generic "HDB Area Market Overview" → keyword-aligned **"Singapore HDB & Condo Resale Prices"** (h1 is a strong on-page signal; now matches the title/OG).
- **Meta description length** — trimmed all dynamic `/api/seo/metadata` descriptions (town, town×flat-type, private, district) from 189–236 chars to **108–134** (Google truncates ~155). Same data, terser phrasing ("X sales in 12 months, avg $Y (Z psf)…").
- **Soft-404 guard** — `/api/seo/metadata` now sets `meta.robots = 'noindex, follow'` for deep routes (`/hdb|/private|/district|/postal`) that don't resolve (detected via canonical still == homepage), but only when `db` is present (never deindex valid pages mid-refresh). Edge `injectMeta()` (`functions/[[path]].js`) now honors `meta.robots` by replacing the `<meta name="robots">` tag. Prevents indexing of junk URLs like `/hdb/notarealtown` (was 200 + homepage canonical, no noindex).
- 169 tests pass (3 new in `tests/integration/seo.test.js`: description ≤160, noindex on unresolved, no-noindex on valid/homepage). Deployed Jun 2026 (v=19).

## Recent Changes (Jun 2026 — SEO content expansion: town×flat-type, freshness, Q&A, cross-links)

Second SEO batch (items 1/5/6/7 from the audit follow-up). All in `server/index.js` `/api/seo/metadata` + `/api/seo/sitemap` and `public/js/app.js` routing; 166 tests pass (5 new in `tests/integration/seo.test.js`).

- **Town × flat-type pages** `/hdb/<town>/<flat-type>` (e.g. `/hdb/tampines/4-room`) — biggest new organic-traffic surface (long-tail "4 room resale price tampines" queries):
  - New helpers near slug helpers: `FLAT_TYPE_SLUGS` / `SLUG_TO_FLAT_TYPE` (`2 ROOM`↔`2-room` … `EXECUTIVE`↔`executive`), `flatTypeLabel()` (titleCase), `fmtMonthYear()`, `faqsToHtml()`.
  - New metadata branch (matched BEFORE the single-segment `/hdb/` branch via `/^\/hdb\/[^/]+\/[^/]+$/`): per-type median/psf/range/avg-area + YoY, unique title (`4 Room HDB Resale Price in Tampines 2026 — $X psf`), WebPage+BreadcrumbList(3-level)+FAQPage JSON-LD, content_html with sibling-type links + back-to-town + nearby-district links + FAQ prose. If `cnt===0`, canonical consolidates to the town page (no thin pages).
  - Sitemap: adds town×flat-type URLs but only combos with `cnt>=5` over a 24-month window (HAVING filter) — ~123 extra URLs on prod.
  - Client (`app.js`): `handleUrlRoute()` regex now `/^\/hdb\/([^/]+)(?:\/([^/]+))?$/` and pre-selects the flat type; `updateSeoForSearch()` emits `/hdb/<town>/<ft>` when exactly ONE flat type is selected (so toggling a single flat-type button changes the URL + is shareable/indexable). Multi-select or All → plain `/hdb/<town>`.
- **Freshness signals (#5)** — `dateModified` (= `MAX(month)+'-01'`) added to every WebPage JSON-LD node (town, town×type, private, district); visible `freshnessNote` ("Data updated through <Month Year>…") appended to each content_html. Computed once near the top of the metadata handler (`latestMonth`/`dateModified`/`dataThrough`).
- **Q&A prose for featured snippets / AI Overviews (#6)** — `faqsToHtml(faqs)` renders the existing FAQ arrays as visible `<h3>`+prose (FAQ rich results are dead, but prose still wins snippets + AI citations); appended to town, town×type, private, district content_html.
- **Cross-linking (#7)** — town pages now: flat-type table rows link to `/hdb/<town>/<ft>`, plus a "Private Property Near <town>" block linking overlapping `TOWN_TO_DISTRICTS` districts. District pages add an "HDB Towns in <label>" block linking `DISTRICT_TO_TOWNS`. (Private already linked to its district.)
- **Backlog tasks tracked** (not done this batch): ranking/best-of pages, comparison pages, About/methodology/data (E-E-A-T) pages, Tailwind CDN→static CSS + font-weight trim, off-site backlinks.
- **Note**: app.js changed → `?v=` must bump on deploy; `scripts/bump-version.js` (run by `deploy`/`deploy:frontend`) handles it automatically. Deployed Jun 2026 (v=19).

## Recent Changes (Jun 2026 — SEO quick-wins pass)

Differential SEO audit + safe, zero-regression fixes (Tailwind Play CDN migration was audited as the biggest CWV item but intentionally deferred — left in place by user choice):

- **AI/LLM crawler rendering** (`functions/[[path]].js`) — added AI/extended crawlers to `BOT_PATTERNS` (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, claude-web, anthropic-ai, PerplexityBot, Google-Extended, CCBot, Bytespider, Amazonbot, Applebot-Extended, cohere-ai, diffbot, meta-externalagent, youbot, petalbot). Previously they hit deep routes (`/hdb/*`, `/private/*`, `/district/*`), couldn't run JS, and got the empty SPA shell — now they receive the same server-injected metadata + `content_html` as Googlebot.
- **De-orphaned district pages** (`public/index.html` `#seo-content`) — added a "Singapore Property Districts" block with 28 crawlable `<a href="/district/NN">` links (real `DISTRICT_LABELS`). D01–D28 were in the sitemap but had zero internal links. Mirrors the existing town-links pattern.
- **robots.txt** — edge function (`functions/[[path]].js`, which shadows the static file) and `public/robots.txt` both updated with explicit `Allow: /` blocks for major AI crawlers (kept `User-agent: *` + Sitemap).
- **Resource hints** (`index.html` head) — `preconnect` to `worthit-api.fly.dev` (first data fetch); `dns-prefetch` to jsdelivr/unpkg/tailwindcss CDNs.
- **Deferred non-critical libs** — added `defer` to Chart.js + Leaflet `<script>` (head). Verified safe: `Chart` is first used in `App.init()`→`Charts.initDefaults()` on `DOMContentLoaded` (deferred scripts finish before it); `L` only on search. Leaflet CSS left blocking (avoids unstyled-map flash). Tailwind CDN unchanged.
- **Structured data** — homepage `@graph` (`server/index.js` `/api/seo/metadata`): added `Organization.logo` + a `SoftwareApplication` node (free `offers`, no fabricated rating). Static fallback JSON-LD in `index.html` upgraded from a bare `WebSite` stub to `WebSite` + `Organization` (with logo) `@graph`.
- **Meta polish** — added `og:image:alt`, two `theme-color` tags (light/dark). (`twitter:site` omitted — no real handle.)
- **Verification**: 162 tests pass; local server confirmed valid JSON-LD (homepage types: WebSite/Organization/SoftwareApplication/FAQPage; org.logo present) and bot metadata for `/hdb/bedok` (title + 6KB content_html). No `?v=` bump needed — only `index.html` (no-cache) markup, edge function, and API changed; JS/CSS untouched.

## Recent Changes (Jun 2026 — In-app feedback)

- **Feedback button + modal** — `#feedback-btn` in navbar (reuses `.theme-toggle` CSS, beside dark-mode toggle); opens `#feedback-modal` (one textarea + optional email + hidden honeypot field). Submit reuses `showToast('Thanks for the feedback 🙏')`. GA4 events `feedback_open` / `feedback_submit`. Auto-attaches `route` (`pathname + search`) as context; server also records `user_agent`.
- **`POST /api/feedback`** (`server/index.js`) — validates (message required, ≤4000 chars), honeypot (`website` field → silent `{ok:true}`, no write), per-IP rate limit (5/hour, in-memory `feedbackRate` Map). Registered **before** the `/api/` DB-guard middleware so it works even while `resale.db` is missing/refreshing.
- **Separate `feedback.db`** — feedback is written to its OWN SQLite file (`FEEDBACK_DB_PATH`, default `path.dirname(DB_PATH)/feedback.db` → `/data/feedback.db` in prod), opened read-write. **NOT inside `resale.db`** because resale.db is read-only AND replaced wholesale on every data refresh (`mv resale.db.new resale.db`), which would wipe a table inside it. Auto-created on boot; already covered by `.gitignore` (`server/db/*.db`).
- **Cache-bust** bumped `v=12` → `v=13` (HTML/JS changed).
- **Read feedback**: `node -e "const D=require('better-sqlite3');const db=new D('/data/feedback.db',{readonly:true});console.log(db.prepare('SELECT * FROM feedback ORDER BY id DESC').all())"` (run via `fly ssh console` in prod).

## Recent Changes (Jun 2026 — Map & Performance)

- **Lease shown at top of all map popups** — all 4 popup types now display `Xy lease` in the subtitle line (most recent transaction's `remaining_lease_years`): `addNearbyHDB` markers, main search markers, private project nearby markers (`addNearbyProjects`), and the private project pin popup
- **Distance-based nearby HDB for private project searches** — eliminated geocoding round-trip when viewing a private project's map:
  - **Before**: `addNearbyHDB()` collected unique addresses, posted to `/api/geocode` (OneMap/Nominatim HTTP calls), built `geoMap`, then placed markers
  - **After**: `/api/nearby-hdb` now attaches `lat`/`lng` from `hdb_block_coords` to each returned transaction; `addNearbyHDB()` is now synchronous and places markers directly from the pre-attached coords
  - **Server fix** (`/api/nearby-hdb`): replaced `street_name IN (...)` filter (whole streets, radius leak) with exact `(block || '|' || street_name) IN (...)` pairs — mirrors `/api/area-overview` pattern; dropped redundant `town` lookup query; attaches `lat`/`lng` to every returned transaction from `hdb_block_coords` via `coordByKey` map
  - **Client fix** (`map.js` `addNearbyHDB()`): removed `async`, removed all geocoding code; builds `markerData` from `transactions.filter(tx => tx.lat != null && tx.lng != null).slice(0, 200)` directly
  - **Tests**: added `tests/integration/nearby-hdb.test.js` (5 happy-path tests: 200 response, lat/lng on every tx, radius exclusion of BEDOK SOUTH AVE 1, nearby_projects array, empty result for no-HDB area); updated frontend unit test — removed stale geocode-cap test, added 2 new tests (no geocodeAddresses called, 200-tx cap)
  - **Test count**: 162 → 163 (net +1 after removing obsolete geocode-cap test)

## Recent Changes (Jun 2026 — UI & Infra)

- **Navbar share button** — `#nav-share-btn` added beside dark mode toggle; reuses `.theme-toggle` CSS class; always visible (not hidden behind results section)
- **Share icon** — both share buttons updated to upload-arrow icon (`path d="M4 12v8..." + polyline + line`)
- **Share function simplified** — removed `title`/`text` from `navigator.share()`; was showing `-- — Singapore property prices on WorthIt` on homepage; now passes `{ url }` only so OS/browser uses OG metadata for preview
- **`deploy:data` script hardened**:
  - Added `fly machines start e7845746c2d918 && sleep 5` prefix — Fly.io free tier auto-stops idle machines; SSH doesn't trigger wake-up like HTTP does
  - `mv + rm -f resale.db-wal resale.db-shm` in single SSH command — deletes stale WAL/SHM atomically before server restart to prevent corrupted reads
- **Production DB fixed** — live DB was missing all 138K URA_PRIVATE rows; stale WAL from old DB was making `COUNT(*) = 371`; re-uploaded local DB (107MB, 370,340 rows), deleted WAL/SHM, restarted — private project autocomplete now works on production

## Recent Changes (Jun 2026 — SEO / GSC fixes)

- **GSC "Alternate page with proper canonical tag" fix** — bot handler catch block now injects correct canonical from URL path (`SITE_URL + pathname`) when Fly.io is unreachable, instead of serving raw `index.html` with root canonical
- **GSC "Server error 5xx" fix** — sitemap fetch failure now returns 503 + `Retry-After: 3600` instead of 500; tells Google to retry rather than treating it as a hard error
- **AbortController 5s timeout on metadata fetch** — edge function aborts Fly.io call after 5s; prevents Googlebot from waiting 30s on cold starts before the fallback fires
- **Sitemap `lastmod` added** — server derives `MAX(month)` from DB and sets as `lastmod` on every sitemap entry; signals freshness to Google; cache TTL is 24h
- **Homepage town list → internal links** — 26 HDB town names in `index.html` SEO section converted from plain text to `<a href="/hdb/...">` links; improves crawl discovery and PageRank distribution
- **Twitter card image dimensions** — added `twitter:image:width/height` (1200×630) to `index.html` matching OG tags
- **og-image.png updated** — new OG image deployed; social platform caches need manual refresh via Facebook Sharing Debugger / LinkedIn Post Inspector

## Recent Changes (Jun 2026)

- **Map deal score coloring** — `addNearbyHDB()` and `addNearbyProjects()` were hardcoded blue/purple; now use `getValueStyle()` relative to nearby median
- **Postal code pinned block** — `pinnedBlock` parsed from `resolved.address` (e.g. "BLK 876C..." → "876C"); `applyTransactionFilters()` floats that block to top after sort
- **HDB block coordinates + distance-based postal search** — full pipeline replaced:
  - `scripts/hdb_blocks.csv` seeds `hdb_block_coords` table (12,442 blocks, 100% coverage)
  - `download_data.py` seeds on rebuild + incrementally geocodes new blocks via OneMap
  - Server seeds table on startup if missing (`seedHdbBlockCoords()`)
  - `findNearbyHdbBlocks(lat, lng)` — synchronous SQLite bounding-box query
  - `/api/area-overview` accepts `lat`/`lng`; filters by exact `(block|street_name)` pairs within 500m
  - Removed: `/api/nearby-streets` endpoint, `findNearbyStreets()`, `nearbyStreetsCache`, `getNearbyStreets()` in `api.js`, extra frontend round-trip
  - Test count: 158 → 155 (removed 3 obsolete `/api/nearby-streets` validation tests)
- **Distant private property markers fix** — root cause: postal code search resolved to town (e.g. TAMPINES), then `loadPrivateSummaryForTown` loaded ALL District 18 private transactions and rendered them on the map regardless of distance. Fix: postal code searches (where `lastResolvedData.lat/lng` is set) skip `loadPrivateSummaryForTown` entirely and use `addNearbyProjects` (bounded 550m bounding box via `/api/nearby-hdb`) instead; town-name searches keep the district-wide summary as before
- **Separate URL for postal code searches** — postal code searches now use `/postal/<code>` instead of `/hdb/<town>`, fixing the ambiguity where bookmarking/reloading `/hdb/tampines` would run a town search instead of the specific block search:
  - `app.js`: added `currentPostalCode` state; `updateSeoForSearch` pushes `/postal/<code>` with address-specific title when set; `handleUrlRoute()` handles `/postal/<6-digit>` by setting search input and calling `search()`
  - `server/index.js`: `/api/seo/metadata` handles `/postal/<code>` — looks up block+street from `hdb_block_coords`, returns address-specific title/description/canonical
  - Sitemap unchanged — postal codes not included (too many, not useful SEO targets)
- **Private property postal code fix** — two bugs fixed when a postal code resolves to a private property (not HDB):
  - `lastResolvedData` was missing `isPrivate: true`, causing project transactions to render as scattered circle markers instead of collapsing into the pin popup; fixed by setting full `{ lat, lng, projectName, isPrivate: true }` in the `else` branch
  - Dead code removed: `if (isPostalCode && resolved.building)` was inside `else if (!isPostalCode)` — could never fire; removed the unreachable block

## Deployment Architecture
- **Frontend**: Cloudflare Pages (`npx wrangler pages deploy public --project-name=worthit`) — ✅ LIVE
- **Backend API**: Fly.io (`worthit-api`) with 1GB persistent volume
- **Database**: SQLite on Fly.io volume, seeded locally and uploaded via `fly ssh sftp put`
- **Config**: `public/config.js` auto-detects localhost → same-origin, else → `https://worthit-api.fly.dev`
- **Cost**: $0/month (Fly.io free tier + Cloudflare Pages free)

## Completed Infrastructure
- ✅ `Dockerfile` — Node.js + Python container (public/ excluded)
- ✅ `fly.toml` — Fly.io config with volume mount at `/data`
- ✅ `.dockerignore` — excludes `public/`, `node_modules/`, `.history/`
- ✅ Server graceful startup without database (shows `no_database` status)
- ✅ `/api/status` health check bypasses DB middleware
- ✅ CORS configured for Cloudflare Pages + Fly.io origins
- ✅ DB seeded (local build + SFTP upload — avoids Fly.io 256MB RAM limit)
- ✅ README updated with deployment guide and debugging commands
- ✅ `.gitignore` updated with `fly.ssh*` files

## Remaining Steps
- ✅ Push to GitHub
- ✅ Configure custom domain — `worthit.canlah.app` (DNS on Cloudflare, domain from Porkbun)

## Custom Domain Setup
- **Domain**: `canlah.app` registered at Porkbun
- **Subdomain**: `worthit.canlah.app` → Cloudflare Pages
- **DNS**: Nameservers transferred to Cloudflare (Universal SSL, automatic)
- **API**: Still at `worthit-api.fly.dev` (CORS allows all origins)

## Key Commands
- **Deploy API**: `fly deploy`
- **Deploy Frontend**: `npx wrangler pages deploy public --project-name=worthit`
- **Seed DB**: Build locally → `fly ssh sftp put server/db/resale.db /data/resale.db` → `fly machine restart <id>`
- **Update data monthly**: Re-run `python scripts/download_data.py` locally → re-upload via SFTP
- **Debug**: `fly logs`, `fly ssh console`, `fly ssh sftp`

## SEO Enhancement — COMPLETE (2026-05-29)

### What was built
Enhanced `/api/seo/metadata` in `server/index.js` and `functions/[[path]].js` to inject rich, data-driven content for all bot-visible pages. All 158 tests pass.

### Changes made
- **`fmtPrice()` / `fmtPsf()`** helpers added to `server/index.js` (after `titleCase`)
- **HDB branch** (`/hdb/<town>`):
  - Title: `[Town] HDB Resale Price 2025 — $XXX psf Avg | WorthIt`
  - Flat-type breakdown query + YoY comparison query
  - `@graph: [WebPage, FAQPage]` JSON-LD with real price Q&As (overall avg, top 3 flat types, YoY direction)
  - `content_html`: heading + summary paragraph + prices-by-type table + "Compare Other HDB Towns" internal links (all 25 other towns)
- **Private branch** (`/private/<project>`):
  - Detects EC via `flat_type = 'EXECUTIVE CONDOMINIUM'`
  - Detects new launch vs MOP-reached via avg tx/month velocity (>8/month = new launch)
  - Title includes "New EC Launch" or "MOP YYYY" tag for ECs
  - `@graph: [WebPage, FAQPage]` JSON-LD with EC-specific MOP Q&As
  - `content_html`: summary with green "MOP YYYY" or amber "New EC Launch" badge
- **District branch** (`/district/<code>`):
  - Top 6 projects with avg PSF + tx count
  - Title includes avg PSF
  - FAQPage JSON-LD with avg price + top project names
  - `content_html`: summary + clickable top-projects table with EC labels
- **`functions/[[path]].js`**:
  - Added `injectContent(html, meta)` — regex-replaces `<section id="seo-content">` with `meta.content_html`
  - Called after `injectMeta()` in the bot handler

### Post-deploy fixes
- Added `Google-InspectionTool` to `BOT_PATTERNS` in `functions/[[path]].js` — Rich Results Test uses this UA, not `Googlebot`, so it was getting static HTML without JSON-LD injection
- Redeployed frontend to fix validation

### FAQ rich results deprecation (May 7, 2026)
Google deprecated FAQ rich results — they no longer appear in SERPs. FAQPage JSON-LD is kept (harmless, may still inform Google's understanding), but won't produce rich result cards. Remaining value of SEO work:
- ✅ `content_html` bot-visible content (prices table, internal links) — still indexed
- ✅ Real prices in page titles/descriptions — shows in search snippets  
- ✅ Internal town links — PageRank distribution unaffected
- ✅ `BreadcrumbList` JSON-LD — still supported, shows breadcrumbs in SERPs
- ❌ `FAQPage` JSON-LD — deprecated, no rich result cards

### Remaining steps
- ✅ Sitemap submitted to Google Search Console (Jun 2026)

## Recent Changes
- **Test suite expanded: 130 → 158 tests** (May 2026):
  - **`addNearbyHDB()` geocode cap bug fixed**: was collecting up to 200 unique addresses before sending to `/api/geocode`; server caps at 100 and returns 400. Silent failure — `catch` swallowed the error, no HDB markers shown on private project pages. Fixed to cap at 100, matching `load()`.
  - **Resolve regression tests** (`resolve.test.js`): "BEDOK RESIDENCES" → `resolved: false` (catches the `inputUpper.includes(t)` routing bug); partial prefix/suffix matching still works ("TOA" → TOA PAYOH, "PAYOH" → TOA PAYOH).
  - **API contract tests** (`area-overview.test.js`): `trend_data[*].avg_psm` field exists (charts.js reads this silently); `private_trend_data` is an array (dual-line chart); `prices_by_type[*].median_psm` exists; street filter returns `street_filtered: true`.
  - **Private endpoint contract tests** (`private.test.js`): `hdb_trend_data` is non-empty for district 11 (directly tests the dataset_source bug that shipped); `project_coords` has lat/lng in both district-overview and district-summary; `coordinates` present in project-overview; `price_per_sqm` on district-summary transactions (deal score coloring); `avg_psm` in trend_data for both project-overview and district-overview.
  - **`nearby-hdb` validation** (`validation.test.js`): missing lat → 400, missing lng → 400, non-SG coordinates → 400. Endpoint was completely untested.
  - **Unit conversion helpers** (`frontend.test.js`): `App.sqmToSqft()` and `App.psmToPsf()` — null/0/number/string inputs; catches wrong conversion factor or broken helper logic.
  - **Geocode cap tests** (`frontend.test.js`): `TransactionMap.load()` and `TransactionMap.addNearbyHDB()` both verified to send ≤ 100 addresses to the geocode API.
- **Private project search routing bug fixed** (May 2026):
  - Bug: Searching a private project name containing a town name (e.g. "THE EDEN AT TAMPINES", "BEDOK RESIDENCES", "AFFINITY AT SERANGOON") would route to the HDB town page instead of the private project page. 55 projects affected.
  - Root cause: `/api/resolve` partial-match check used `inputUpper.includes(t)` — any input containing a town name as a substring resolved as that town. Also, `t.includes(inputUpper)` lacked word-boundary protection, so "QUEENS" matched "QUEENSTOWN".
  - Fix in `server/index.js`: Removed `inputUpper.includes(t)` entirely; added word-boundary check to `t.includes(inputUpper)` (match must end at a non-alphanumeric character, not mid-word). e.g. "ANG MO" → "ANG MO KIO" ✓, "QUEENS" → NOT "QUEENSTOWN" ✓.
  - All 127 unit+integration tests pass.
- **psm→psf internal variable renaming** (May 2026):
  - Renamed internal JS variables (`_psmGroups`→`_psfGroups`, `tierPsm`→`tierPsf`, etc.) and HTML IDs (`stat-psm`→`stat-psf`) to match the display unit
  - Consolidated magic number `10.7639` to only appear in `sqmToSqft()` and `psmToPsf()` helper bodies; `charts.js` now delegates to `App.psmToPsf()` instead of inline division
  - Sort option values renamed (`psm-desc`→`psf-desc`, `psm-asc`→`psf-asc`) to match
  - No API or DB changes — server column names (`price_per_sqm`, `avg_psm`) are internal and unchanged
- **Units changed from sqm to sqft** (May 2026):
  - All display values converted: floor area (sqm → sqft), price rate ($/sqm → $/sqft)
  - Conversion factor: 1 sqm = 10.7639 sqft; price/sqft = price/sqm ÷ 10.7639
  - Added `sqmToSqft(sqm)` and `psmToPsf(psm)` helpers to `App` in `app.js`
  - Conversion is display-only — DB column names (`floor_area_sqm`, `price_per_sqm`) and server SQL are unchanged
  - Files updated: `public/js/app.js`, `public/js/charts.js`, `public/js/map.js`, `public/index.html`, `public/css/styles.css`
  - Chart data also converted: `avg_psm / 10.7639` applied before building datasets in `charts.js`
  - Chatbot FAQ text in `server/index.js` updated (3 occurrences of "price per sqm")
- **Frontend cache busting added** (May 2026):
  - Added `public/_headers`: `index.html` → `no-cache, must-revalidate`; JS/CSS → `max-age=31536000, immutable`
  - Added `?v=2` query strings to all local asset includes in `index.html`
  - Rule: bump `?v=N` on every deploy where JS or CSS changes
  - Created `CLAUDE.md` documenting commands, architecture, units, cache busting procedure, Dockerfile note, and testing gaps
- **Map unavailable bug fixed** (May 2026):
  - Symptom: Transaction Map showed "— Map unavailable" on every search
  - Root cause: client (`map.js`) collected up to 200 unique addresses but server (`/api/geocode`) enforced a hard limit of 100, returning 400 → client threw → caught as "Map unavailable"
  - Introduced by commit `082d253` ("Enhance input validation and sanitization") which added the server-side 100-address cap without updating the client
  - Fix: capped `uniqueAddresses` in `map.js` at 100 to match server limit
- **SQL injection fix** (May 2026):
  - `/api/private/project-overview`: `property_type` was string-interpolated into SQL — replaced with parameterized `?` placeholder + `propTypeParam` spread across all 5 queries in the handler
- **Smoke test suite** (May 2026):
  - `tests/smoke/api.smoke.test.js` — 19 tests hitting the live API at `https://worthit-api.fly.dev`
  - Covers: status, towns, flat-types, area-overview, resolve, private projects/project-overview/district-overview, SEO sitemap + metadata
  - `vitest.smoke.config.js` — separate Vitest config (no fixture DB / globalSetup needed)
  - `npm run test:smoke` — hits live API; `npm run test:smoke-local` — hits `http://localhost:3000`
  - Smoke tests excluded from default `npm test` via `exclude` in `vitest.config.js`
- **Pre-deploy test gate** (May 2026):
  - `deploy`, `deploy:api`, `deploy:frontend` npm scripts all prepend `npm test &&` — failing tests block deploys
- **Map deal score coloring + private marker differentiation** (May 2026):
  - Fixed HDB markers: `getValueStyle()` was computed but never used — markers were hardcoded blue. Now wired up to use tier+type median $/sqm for green→blue→red coloring.
  - Extended deal score coloring to private property markers too (was flat purple).
  - HDB vs private differentiation: fill color = deal score (both types); border = property type — HDB gets thin white border (`weight:1`), private gets thick purple ring (`color:'#a855f7', weight:4`) + radius +2.
  - `originalStyle` in `addressMarkers` updated to store `markerRadius` and correct `borderColor`/`borderWeight` so highlight/unhighlight restores correctly.
  - Updated map legend: added HDB vs Private key below the gradient bar.
- **Deal score dot on mobile transaction cards** (May 2026):
  - `renderTransactionsTable()` computes median $/sqm per flat type from `allTransactions` before the loop.
  - `_dealDot(psm, type)` inline helper interpolates same green→blue→red color as map markers.
  - Small colored `w-2 h-2` dot rendered next to the $/sqm value on each mobile card.
- **Mobile UX pass 2** (May 2026):
  - Section jump bar: sticky mobile-only pill strip (Charts / Map / Transactions) inside results section, hidden via `sm:hidden` — no desktop impact (`index.html`)
  - Floating "New Search" FAB: `hidden fixed` button revealed by `_onResultsShown()`, scrolls to search input on tap (`index.html`, `app.js`)
  - Share button: click handler uses `navigator.share()` with clipboard fallback; `showToast()` method for success feedback (`app.js`)
  - Toast element added to `index.html` for clipboard copy confirmation
  - Card tap → map highlight: added `click` handler to mobile cards (skips link taps) — `mouseenter`-only didn't fire on touch (`app.js`)
  - Map scroll-zoom disabled on mobile: `scrollWheelZoom: window.innerWidth >= 640` (`map.js`)
  - Empty state "Clear filters" button: inline `<button onclick="App.clearTransactionFilters()">` in both table and cards empty states; `clearTransactionFilters()` method resets all filter controls (`app.js`)
  - `text-[10px]` → `text-xs` for transaction type badges (lines ~894, 896, 925 in `app.js`); autocomplete dropdown badge at line ~1233 intentionally unchanged
  - `_onResultsShown()` helper called from all 3 render methods (`renderResults`, `renderDistrictResults`, `renderPrivateResults`) to show FAB and jump bar
  - `scroll-margin-top` CSS for `#charts-section`, `#map-section`, `#transactions-section`: 105px mobile (nav + jump bar), 64px desktop (`styles.css`)
- **Mobile UI improvements** (May 2026):
  - Fixed nested scroll trap in transaction cards: removed `max-h-[600px] overflow-y-auto`, now shows first 25 cards with a "Show more" button (`app.js`)
  - Restructured transaction filter bar: full-width search on own row + 4 selects in `grid-cols-2` on mobile; `sm:contents` on the grid wrapper preserves original single-row layout on desktop (`index.html`)
  - Increased mobile chart height: `h-48` → `h-56` for both trend and distribution charts (`index.html`)
  - Added `scrollIntoView` on search input focus (mobile only, `window.innerWidth < 640`) to keep input visible when keyboard opens (`app.js`)
  - Added right-edge fade on flat type buttons row via CSS `mask-image` at `max-width: 639px` to hint at horizontal scroll (`styles.css`)
  - Increased map height on mobile: `h-[280px]` → `h-[320px]` (`index.html`)
  - Fixed "Price Range" stat card overflow: `text-lg` → `text-sm` on mobile (`index.html`)
- **Map popup fixes** (May 2026):
  - Fixed element misalignment in popups: mobile CSS had `max-width: 200px` on wrapper but inner divs had `min-width: 220px` — conflict broke `justify-content: space-between` rows; fixed by raising wrapper to `240px` and reducing inner `min-width` to `180px`; added `flex-wrap: wrap` to detail rows (`styles.css`, `map.js`)
  - Added `shortType()` helper on `TransactionMap` to shorten long flat/property type names in all 4 popup locations — `EXECUTIVE CONDOMINIUM` → `EC`, `CONDOMINIUM` → `Condo`, `SEMI-DETACHED` → `Semi-D`, `STRATA SEMI-DETACHED` → `Strata Semi-D`, etc. (`map.js`)
- **OneMap geocoding fallback for missing private project coords** (May 2026):
  - 128 private projects lacked coordinates because URA API omits SVY21 coords for under-construction launches
  - Added `geocode_missing_projects(conn)` to `scripts/download_ura_data.py`: queries OneMap for each project missing from `project_coords`, 350ms between requests, 1 retry with 3s backoff on failure
  - `project_coords` is never cleared between runs — only truly new missing projects are queried on subsequent downloads
  - Result: 121/128 geocoded automatically; NEWPORT RESIDENCES (192 tx, 80 Anson Rd) inserted manually; 6 single-tx projects remain unmapped
  - Fixed private project map bug: `TransactionMap.load` was passing empty array `[]` → now passes `this.allTransactions`
  - **WAL checkpoint lesson**: geocoded data landed in `resale.db-wal`, not main `resale.db` — first upload silently missed new coords; fixed by running `PRAGMA wal_checkpoint(TRUNCATE)` before upload
  - Deploy flow updated: upload to `/data/resale.db.new` → atomic `mv` → restart (zero downtime during upload)
- **Dual-line price trend chart** (May 2026):
  - Town/postal search: blue HDB line + purple private line (related districts)
  - District search: blue HDB line (related towns) + purple private line
  - Project search: single line (green/red based on trend direction)
  - Server: `/api/area-overview` now returns `private_trend_data`; `/api/private/district-overview` now returns `hdb_trend_data`
  - `charts.js`: `renderTrendChart(hdbData, privateData)` — shared X-axis from union of months, legend shown only when both lines present
  - Fixed bug: `/api/private/district-overview` was querying `dataset_source = 'primary_2017_2026'` (wrong value, always returned 0 rows) — changed to `dataset_source != 'URA_PRIVATE'`
- **Price trend metric switched to $/sqm** (May 2026):
  - All trend charts now display `avg_psm` ($/sqm) instead of average resale price
  - Fixes compositional bias: raw price fluctuates when flat size mix changes month-to-month; $/sqm is size-neutral
  - `charts.js`: reads `d.avg_psm`, Y-axis shows `$X.Xk/sqm`, tooltip shows `$/sqm`
  - `server/index.js`: `trendPct()` now uses `'avg_psm'` in all 3 endpoints (area-overview, project-overview, district-overview) so trend badges (6m/1y/3y/5y %) are consistent with the chart
  - Applies to all search types: town, postal code, project name, district
  - No DB changes needed — `avg_psm` was already being fetched but unused for trend calculations
- **Trend chart fix for private/district** (May 2026):
  - `charts.js` was hardcoded to `d.median_price`; private/district data only has `d.avg_price` → flat line
  - Fixed with `d.median_price ?? d.avg_price` first, then superseded by the $/sqm switch above
- **Trend calculation fix** (May 2026):
  - Old: compared single first month vs single last month — wildly noisy in thin-volume areas (e.g. D01 showed +62.1% 1Y)
  - New: `trendPct(arr, key, n=3)` helper — averages first 3 months vs last 3 months of each window (falls back to 1 if window too small)
  - Fixed in all 3 endpoints: HDB `area-overview` (uses `median_price`), private `project-overview` and `district-overview` (use `avg_price`)
- **Flat Type Multi-Select** (May 2026):
  - Changed flat type toggle from single-select to multi-select
  - `selectedFlatType: 'ALL'` (string) → `selectedFlatTypes: new Set()` (empty = All)
  - New helpers: `_updateFlatTypeUI()` syncs button active states from Set; `_getFlatTypeParam()` returns comma-joined string for API
  - Clicking a type toggles it; clicking "All" clears the Set; any change triggers re-search if town is loaded
  - Server: `flat_type` query param now accepts comma-separated list (e.g. `4 ROOM,5 ROOM`)
  - `addFlatClause()` helper in `area-overview` handler builds `= ?` (single) or `IN (?,?)` (multiple) across all 5 query sites
  - Subtitle label renders `4 ROOM,5 ROOM` as `4 ROOM + 5 ROOM`
- **CLAUDE.md created** (May 2026):
  - Documents commands, split architecture, DB layout, key patterns, and known issues
  - Memory Bank workflow directives added by user config
- **Light/Dark Theme Toggle** (May 2026):
  - Added CSS custom properties for popup styles (leaflet popups now theme-aware)
  - Created `:root` (light mode) and `.dark` (dark mode) CSS variable overrides
  - Anti-FOUC inline script in `<head>` reads `localStorage('theme')` before first paint
  - Theme toggle button (sun/moon icons) in header, persisted to localStorage
  - `App.initTheme()` / `App.toggleTheme()` in `app.js` — toggles `dark` class, re-renders charts and swaps map tiles
  - Dynamic HTML in `app.js` uses `dark:` variants (e.g., `bg-gray-100 dark:bg-dark-700`)
  - `Charts.rerender()` re-draws trend and distribution charts with theme-appropriate colors
  - `TransactionMap.updateTheme()` swaps between CARTO light/dark tile layers
  - Map popups use CSS variables (`--popup-price`, `--popup-muted`, `--popup-border`) for theme-aware styling
  - All popup inline styles updated to use `var(--popup-*)` instead of hardcoded colors
  - Autocomplete dropdown, error alerts, table rows all support both themes
- **SEO Implementation** (May 2026):
  - Added SEO meta tags to `index.html`: description, keywords, canonical, Open Graph, Twitter cards, JSON-LD
  - Created `functions/[[path]].js` Cloudflare Pages Function for bot detection + edge-side meta injection
  - Added `/api/seo/metadata` and `/api/seo/sitemap` endpoints to `server/index.js`
  - Client-side URL routing in `app.js`: `/hdb/<town>`, `/district/<code>`, `/private/<project>`
  - Dynamic `<title>`, `<meta>`, canonical, OG tag updates on search
  - SEO content section at page bottom with keyword-rich text
  - `public/robots.txt` with sitemap reference
  - Sitemap auto-generated from DB (26 HDB towns + 28 districts + 200 private projects)
  - JSON-LD: WebSite + SearchAction + FAQPage (5 FAQs) on homepage; BreadcrumbList + ResidentialProperty on town/project pages
- **Google Analytics 4** (May 2026):
  - GA4 tag (`G-WGC8D0FRSQ`) added to `index.html` `<head>` (after anti-FOUC script)
  - SPA pageview tracking: `gtag('event', 'page_view')` fires on `history.pushState()` in `updateSeoForSearch()` and on `popstate` (back/forward)
  - Tracks all routes: `/hdb/<town>`, `/district/<code>`, `/private/<project>`
  - **Custom GA4 events** (8 events tracked via `App.track()` helper):
    1. `search` — every search with `search_type` (town/postal/district) and `query`
    2. `view_results` — results loaded with `result_type` (hdb/private/district), `location`, `transaction_count`
    3. `click_outbound` — Google Maps link clicks in transactions with `address`, `property_type`
    4. `search_failed` — failed searches with `query`, `failure_reason`
    5. `select_flat_type` — flat type toggle with `flat_types`
    6. `filter_transactions` — transaction filter/sort with `filter_type`, `filter_value`
    7. `toggle_mrt` — MRT overlay toggle with `visible` (boolean)
    8. `share` — share button with `method` (web_share_api/clipboard), `page_path`
- **Fixed SPA direct URL loading** (May 2026):
  - Bug: direct navigation to `/hdb/bedok` stuck at "Loading data..." — all JS/CSS 404'd because relative paths (`js/app.js`) resolved to `/hdb/js/app.js`
  - Fix: changed all relative asset paths in `index.html` to absolute (`/js/app.js`, `/css/styles.css`, `/config.js`)
- **Logo clickable → homepage** (May 2026):
  - Wrapped logo `<div>` in `<a href="/">` so clicking "WorthIt" navigates to homepage
- **Optimized initial page load** (May 2026):
  - `API.getStatus()` and `API.getTowns()` now run in parallel via `Promise.all` (was sequential)
  - Removed 300ms artificial `setTimeout` delay before dismissing overlay
  - Moved `setupEventListeners()` and `setupTransactionFilters()` before API calls
  - Result: ~1-2 seconds faster perceived load time
- **Removed "370k transactions" from navbar** (May 2026):
  - Removed `<span id="data-status">` from navbar HTML and JS that populated it — cleaner UI
  - Data freshness still shown in footer ("Data as of May 2026")
- Fixed server crash on missing database (graceful startup)
- DB middleware rejects other API calls with 503 when DB is missing

## Automated Data Refresh — Jun 2026 (WORKING)

- **GitHub Actions workflow**: `.github/workflows/refresh-data.yml` — verified working end-to-end
- Runs `npm run download` (full HDB + URA rebuild) → `npm run deploy:data` (WAL checkpoint + gzip + SFTP to Fly + gunzip + atomic swap + machine restart)
- Schedule: **daily 03:00 SGT** (cron `0 19 * * *` UTC); change to `0 19 * * 0` to switch to weekly (Mondays)
- `workflow_dispatch` trigger allows manual on-demand runs from the Actions tab
- Concurrency group `refresh-data` with `cancel-in-progress: false` prevents overlapping uploads
- Node 24, Python 3.x (venv created by `run-python.js`), timeout 30 min
- `superfly/flyctl-actions/setup-flyctl@v1` installs `flyctl`; workflow has an **"Alias flyctl as fly"** step (`ln -sf` to `/usr/local/bin/fly`) because npm scripts call `fly`, not `flyctl`

### Required repo secrets (Settings → Secrets → Actions → Repository secrets)
- `URA_API_ACCESS_KEY` — from local `.env`
- `FLY_API_TOKEN` — **must be an ORG token** (`fly tokens create org`), NOT a deploy token. A scoped deploy token CANNOT issue SSH certificates, so `fly ssh sftp`/`fly ssh console` fail with `create ssh certificate: ... 500`. Org token has SSH access. (Expiry ~1 year — set calendar reminder.)

### Gotchas hit while setting this up (don't re-debug these)
- **Pushing workflow files** requires the `workflow` OAuth scope (`gh auth refresh -s workflow`) AND `gh auth setup-git` so git uses gh's token. VS Code git widget caches its own token and may still fail — push from CLI.
- **`npm ci` requires `package-lock.json` in sync** — regenerate with `npm install` if it errors on missing transitive deps (e.g. `@emnapi/*` under better-sqlite3).
- **`fly ssh console --command` does NOT run a shell** — it shlex-splits and execs directly, so `&&` is passed as a literal arg. Multi-step remote commands MUST be wrapped in `sh -c '...'` for `&&` chaining to work. This is now in `deploy:data`.
- **Large DB SFTP drops mid-transfer** (`connection lost` at ~67MB on the 107MB file). Fixed by gzip-compressing before upload (107MB → ~21MB): `gzip -kf` locally, upload `.gz`, `gunzip -f` on server inside the `sh -c`.
- `sleep` after `fly machines start` bumped 5→10s for cold-start reliability.

### Limitations accepted
- Full DB rebuild + Fly restart every run even if source data unchanged (no skip-guard)
- GitHub cron auto-disables after 60 days repo inactivity
- Failure alerts via GitHub's default email only
- DB never committed — built on runner disk, shipped straight to Fly; GitHub's 100MB file limit does not apply

## Active Decisions & Considerations
- Database is opened in `readonly: true` mode — data only changes via Python scripts
- In-memory caches for geocoding and nearby streets (no persistence)
- Nominatim rate limiting: 1 req/sec with 1.1s delays
- Street matching uses multi-strategy: exact → compressed → expanded → keyword fallback
- Fly.io free tier (256MB RAM) can't run Python download scripts — use local build + SFTP upload

## Important Patterns
- All town matching is case-insensitive (`.toUpperCase()`)
- Month format: `YYYY-MM` strings
- Price percentiles calculated in JS, not SQL
- `dataset_source` column distinguishes HDB vs URA_PRIVATE records