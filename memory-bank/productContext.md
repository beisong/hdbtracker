# Product Context: WorthIt

## Why This Project Exists
Singapore's HDB resale market is complex — prices vary by town, flat type, floor area, storey, lease remaining, and street. Buyers need a quick way to assess if an asking price is fair based on actual transaction data, not just agent estimates.

## Problems It Solves
1. **Information asymmetry**: Buyers lack easy access to comparable transaction data
2. **Manual research burden**: Checking individual transactions on data.gov.sg is slow and clunky
3. **Price context**: Raw transaction lists don't tell you if a price is good or bad relative to the market
4. **Geographic uncertainty**: Postal codes don't directly map to HDB "town" categories used in data

## How It Works — User Flow
1. User enters a **postal code**, **town name**, **district code** (D01–D28), or **private project name**
2. If postal code: OneMap API resolves it to lat/lng → `hdb_block_coords` distance query finds nearby HDB blocks within 500m (no Nominatim needed)
3. User can multi-select **flat types** (2–5 Room, Executive) to filter results
4. The app displays:
   - **Area overview**: median prices, transaction volume, popular flat types
   - **Price trends**: dual-line chart (blue HDB + purple private) with 6m/1y/3y/5y % change
   - **Price distribution**: histogram of transaction prices
   - **Deal Score map**: color-coded markers (green=good value, red=premium) relative to nearby median
   - **Comparable transactions**: filterable/sortable table with floor, area, lease, $/sqft
5. For private properties: search by project name → project overview with district context
6. URL routing: `/hdb/<town>`, `/district/<code>`, `/private/<project>`, `/postal/<code>` — shareable and bot-indexable

## User Experience Goals
- **Instant**: Results appear within seconds
- **Visual**: Charts and maps make data intuitive
- **Actionable**: Clear metrics (Deal Score, percentiles) that inform buying decisions
- **Comprehensive**: Both HDB and private property coverage
- **Local**: Understands Singapore-specific geography (postal codes, towns, street abbreviations)