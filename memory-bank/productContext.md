# Product Context: WorthIt

## Why This Project Exists
Singapore's HDB resale market is complex — prices vary by town, flat type, floor area, storey, lease remaining, and street. Buyers need a quick way to assess if an asking price is fair based on actual transaction data, not just agent estimates.

## Problems It Solves
1. **Information asymmetry**: Buyers lack easy access to comparable transaction data
2. **Manual research burden**: Checking individual transactions on data.gov.sg is slow and clunky
3. **Price context**: Raw transaction lists don't tell you if a price is good or bad relative to the market
4. **Geographic uncertainty**: Postal codes don't directly map to HDB "town" categories used in data

## How It Works — User Flow
1. User enters a **postal code** or **town name** in the search bar
2. If postal code: OneMap API resolves it to a road name, which is matched to an HDB town
3. User selects **flat type** (e.g., 4-ROOM, 5-ROOM) and optionally enters an **asking price**
4. The app displays:
   - **Area overview**: median prices, transaction volume, popular flat types
   - **Price trends**: 6-month, 1-year, 3-year, 5-year price change charts
   - **Price distribution**: histogram showing where the asking price falls
   - **Comparable transactions**: table of similar recent sales with details
   - **Map view**: transactions plotted on a map with markers
5. For private properties: user can search by project name and get similar analysis

## User Experience Goals
- **Instant**: Results appear within seconds
- **Visual**: Charts and maps make data intuitive
- **Actionable**: Clear metrics (Deal Score, percentiles) that inform buying decisions
- **Comprehensive**: Both HDB and private property coverage
- **Local**: Understands Singapore-specific geography (postal codes, towns, street abbreviations)