# Project Brief: WorthOrNot (HDB Tracker)

## Overview
WorthOrNot is a Singapore HDB resale flat value assessment tool. It downloads ~230,000 HDB resale transaction records from data.gov.sg's open API, stores them in a local SQLite database, and provides a web-based UI for users to evaluate whether a specific flat is fairly priced.

## Core Goals
1. **Data Pipeline**: Fetch all HDB resale flat price data from data.gov.sg and URA private property data, storing in SQLite with pre-computed aggregations
2. **Market Analysis API**: Provide REST API endpoints for querying comparable transactions, price trends, distributions, and percentiles
3. **Valuation UI**: Single-page app where users input flat details and instantly see deal quality metrics
4. **Private Property Support**: Extended to also cover URA private property/resale transactions

## Scope
- Singapore HDB resale flats (primary)
- URA private property resale transactions (secondary)
- Historical transaction data analysis only — not live listings
- Indicative valuations, not professional appraisals

## Key Features
- Deal Score (0-100) based on comparable transactions
- Fair Market Value estimation
- Price trend analysis (6m, 1y, 3y, 5y)
- Price distribution histograms
- Comparable transaction tables
- Postal code → town resolution (OneMap API)
- Map visualization with transaction markers
- Private property project search and analysis