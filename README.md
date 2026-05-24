# 🏠 WorthIt — HDB Resale Flat Value Detective

Instantly check if a Singapore HDB resale flat is fairly priced based on real transaction data from data.gov.sg.

## Quick Start

### 1. Install Dependencies

```bash
# Node.js dependencies
npm install

# Python (for data download)
pip install requests
```

### 2. Download Data

```bash
npm run download
```

This downloads ~230,000 HDB resale transaction records from data.gov.sg into a local SQLite database. It takes about 5-10 minutes depending on your internet connection.

### 3. Start the Server

```bash
npm start
```

Open http://localhost:3000 in your browser.

## How It Works

1. **Data Pipeline**: A Python script downloads all HDB resale flat price data from data.gov.sg's open API and stores it in a SQLite database with pre-computed aggregations.

2. **Backend API**: A Node.js/Express server provides REST API endpoints that query the SQLite database for comparable transactions, price trends, and distributions.

3. **Frontend**: A beautiful single-page app where users input flat details (town, flat type, floor area, asking price) and instantly see:
   - **Deal Score** (0-100): How good a deal the asking price represents
   - **Fair Market Value**: Based on comparable recent transactions
   - **Price Trend**: Whether prices are rising or falling
   - **Price Distribution**: Where the asking price falls among recent transactions
   - **Comparable Transactions**: Table of similar recent sales

## Tech Stack

- **Data**: data.gov.sg HDB Resale Flat Prices API
- **Pipeline**: Python 3 + SQLite
- **Backend**: Node.js + Express + better-sqlite3
- **Frontend**: Vanilla JS + Tailwind CSS + Chart.js
- **Fonts**: Inter (Google Fonts)

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Database status and record count |
| `GET /api/towns` | List all towns |
| `GET /api/flat-types` | List all flat types |
| `GET /api/flat-models` | List all flat models |
| `GET /api/storey-ranges` | List all storey ranges |
| `GET /api/evaluate` | Main evaluation endpoint |
| `GET /api/trend` | Monthly price trend data |
| `GET /api/distribution` | Price distribution histogram data |

## Project Structure

```
WorthIt/
├── scripts/
│   └── download_data.py      # Python data download script
├── server/
│   ├── index.js               # Express server
│   └── db/
│       └── resale.db           # SQLite database (generated)
├── public/
│   ├── index.html             # Main SPA
│   ├── css/
│   │   └── styles.css         # Custom styles
│   └── js/
│       ├── api.js             # API client
│       ├── charts.js          # Chart.js configs
│       └── app.js             # Main app logic
├── package.json
├── requirements.txt
└── README.md
```

## Data Source

Data from [Housing & Development Board](https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc), via data.gov.sg.

## Disclaimer

Prices shown are indicative and based on historical transaction data. They should not be considered as professional valuations. Always consult a licensed valuer or property agent for formal advice.