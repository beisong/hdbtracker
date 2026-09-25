# Coral Green

**Launch:** December 2004 BTO (2004-12-28 to 2005-01-23)
**Town:** SENGKANG (Non-Mature Town)
**Location:** Sengkang. Premium flats. Exact address/block and geocoding unrecoverable — not found in OneMap under any name variant tried.

## Flat Supply

| Type | Floor Area (sqm) | Units | Price Range |
|---|---|---|---|
| 4-Room | -- | 655 | TBD |

## Curation Note

Predates HDB's Oct 2024 Standard/Plus/Prime classification framework AND predates the 2-Room Flexi scheme. Two projects launched together on 28 Dec 2004 (confirmed via contemporaneous Straits Times, Today, and Berita Harian coverage indexed on NLB's NewspaperSG), HDB's 'second batch of flats in 2004 under the build-to-order scheme': Anthias (Punggol, Standard, 134x3-Room + 600x4-Room = 734 units) and Coral Green (Sengkang, Premium, 655x4-Room). Both totals match housingmap.sg exactly. Application originally closed 16 Jan 2005 but was extended to 23 Jan 2005 — the extended date is used here as the actual application_end. No pricing was recoverable for either project from any source (the VSF microsites for both exist in Wayback's CDX index but, consistent with the 2004-2005 pattern, only render frame/nav pages with no price content ever crawled). **Neither project could be geocoded**: OneMap has no record of 'Anthias' or 'Coral Green' under any name variant tried, unlike every other project in this dataset — both precinct names appear to have been fully superseded/delisted from OneMap's current index (first such case in this backfill). lat/lng recorded as null for both projects; verified this is handled safely by existing code (server/index.js:2244 already guards `head.lat == null || head.lng == null` in the comps-ladder fetch, falling through to the town-level fallback, and the frontend map code already checks `resolvedData.lat && resolvedData.lng` before placing a marker) — the project pages will simply render without a map pin.

## Sources

- https://eresources.nlb.gov.sg/newspapers/digitised/issue/straitstimes20041228-1
- https://eresources.nlb.gov.sg/newspapers/digitised/issue/today20041228-1
