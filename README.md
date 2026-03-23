# Re-Order Request Management

A single-page HTML app for creating and managing re-order requests and shipment plans. Replaces manual Excel workflows.

## Features

- **Two views**: Sir Ohad (internal, with costs) and Supplier (external, no costs)
- **Airtable integration**: Enter an ASIN to auto-pull Product Name, UPC, FNSKU, Pack Quantity, and Cost from your Airtable Products Catalog
- **Live exchange rate**: CNY to USD rate fetched automatically
- **Styled Excel export**: Download either or both views as formatted Excel files (Lexend font, color-coded sections)
- **Multiple requests**: Create, save, and manage multiple re-order requests
- **Data persistence**: All data saved locally in your browser (localStorage)

## How to Use

1. Open `Re-Order Request Management.html` in your browser
2. Click the gear icon and enter your Airtable Personal Access Token
3. Click **+ New Request** to start a new re-order
4. Enter ASINs — product data auto-fills from Airtable
5. Set S1 (Air) and S2 (Sea) unit quantities per item
6. Switch to Sir Ohad View or Supplier View to preview
7. Download as Excel when ready

## Setup

No installation needed. Just open the HTML file in a browser.

Your Airtable token is stored in your browser's localStorage — it is never included in the file itself, so this repo is safe to share.
