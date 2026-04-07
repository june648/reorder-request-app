# Re-Order Request App

## Overview
A single-page HTML app for managing re-order requests and shipment plans. Replaces manual Excel creation for two audiences:
- **Sir Ohad View**: Internal view with ASIN, Product, Units, Pieces, Cost RMB, Est. Cost USD
- **Supplier View**: External view with FN SKU (=ASIN), UPC, SKU (=Master SKU), Product Description (from Yun Description), Units, Pieces (no costs)

## Location
`D:\SCM\Re-order-Request-App\Re-Order Request Management.html`

## Tech Stack
- Single HTML file with inline CSS and JS (no build tools)
- xlsx-js-style (v1.2.0) via CDN for styled Excel export
- Airtable API for ASIN lookups
- localStorage for data persistence and templates

## Airtable Integration
- **Base**: `appIi4INnoNSh9kru` (Order Management App for Seattle Cell Market)
- **Token**: `Re-Order Request App` PAT (scopes: data.records:read/write, schema.bases:read/write)
- **Products Catalog Table**: `tblLixRBZkc3IViAG` — used for ASIN lookups
  - **Fields pulled by ASIN** (API returns by field name, not ID):
    - `Product Name` (flddTbwZaTAcoCQfk)
    - `UPC` (fldmq4nA7m6uYWioo)
    - `Pack Quantity` (fldpsVMUPCz3JvYYn)
    - `Master SKU` / FNSKU (fldYoqEElKrjS3S7t)
    - `Per Piece Cost (RMB)` (fldSc8CgYfqydf9Vf)
    - `Yun Description` (fldffzSXF7Tsjs8xD)
- **Reorder Requests Table** (auto-created on first push) — master request records
  - Fields: Reference ID, Title, Subtitle, Date, Shipments Config (JSON), S1/S2 Method/Destination/Description (backward compat), S1–S10 Name (shipment labels), Total Items/Units/Pieces, Total Cost RMB/USD, Exchange Rate, Status (Draft/For Approval/Approved), Notes
- **Reorder Line Items Table** (auto-created on first push) — individual product rows, linked to parent request
  - Fields: Reference ID (primary), Request (linked record), ASIN, Product Name, UPC, FNSKU, Yun Description, Type (Catalog/New Product), Pack Qty, Cost Per Piece RMB, Units By Shipment (JSON), S1–S10 Units, Total Units, Total Pieces, Cost RMB, Cost USD
- Table IDs cached in localStorage under `airtable_reorder_tables` key
- User's Airtable PAT stored in localStorage (configured via Settings gear icon)

## Branding
- Full-width blue header bar (#3a5bc7) with Seattle Cell Market logo (white filter), divider, app title, "Internal Tools" subtitle
- Logo file: `logo.png` in root and `public/` directories (sourced from SCM Dashboard project)
- Top bar sits outside the `.app` container to span full viewport width

## App Structure
- **List Screen**: Shows all saved re-order requests as cards (title, date, item/unit/piece counts). "+ New Request" button to create. Click a card to open it. Delete button per card (hidden for Approved requests).
- **Editor Screen**: Opened when a request is selected. Has Back/Save/Delete buttons (Delete hidden when Approved) and a Status dropdown in a top bar.
  - **Data Entry tab**: Shipment config (add/remove shipments, method, destination, description) + item table. Pack Qty is read-only (pulled from Airtable). Exchange rate field in header (editable, with "Fetch Live" button, saved per request).
  - **Sir Ohad View tab**: Formatted view with costs, subtotals, grand total — downloadable as Excel
  - **Supplier View tab**: Formatted view without costs — downloadable as Excel
  - **Summary tab**: Overview cards, shipment breakdown, notes
- **Load from Airtable**: Fetches requests from Airtable. Only shows requests not yet imported locally (no duplicates). Each card has an "Import" button to pull the full request (shipments, items, units, costs, status, notes) into local editable storage, linked to Airtable record IDs for future push/update. Clicking a card without importing shows a read-only detail view with an "Import to Local & Edit" button. Once imported, the request appears as a normal local card and is hidden from the Airtable list.
- **Navigation**: Back button returns to list, auto-saves current request. Multiple requests stored in localStorage under `reorder_requests` key (array of {id, refId, createdAt, state, airtableRequestRecordId, airtableLineItemRecordIds, lastPushedAt}).

## Item Types
Each item row has a **Type** dropdown (first column):
- **Catalog**: Default. Enter ASIN → auto-pulls Product Name, UPC, FNSKU, Pack Qty, Cost/pc from Airtable. These fields are read-only.
- **New Product**: For products not yet in the Airtable catalog. ASIN field is disabled. Product Name, UPC, FNSKU, Pack Qty are all manually editable.
- The `type` field (`'catalog'` or `'new'`) is persisted per item. Existing saved items without a type default to `'catalog'`.

## Reference ID
- Format: `SCM0000001` — sequential 7-digit zero-padded number
- Auto-generated on new request creation, assigned retroactively to older requests on open
- `generateRefId()` checks both local requests AND cached Airtable ref IDs (`knownAirtableRefIds`) to avoid collisions — user must "Load from Airtable" at least once before creating new requests on a fresh origin
- Duplicate ref IDs in Airtable are auto-detected and fixed during "Load from Airtable" (`fixDuplicateAirtableRefIds`) — newer duplicate records get reassigned to the next available ID, including their line items
- Displayed as badge on list cards and in editor bar
- Pushed to Airtable as the key identifier for both request and line item records

## Status
- Dropdown in editor bar with five values: **Draft** (yellow), **For Approval** (blue), **Approved** (green), **Shipped** (purple), **Cancelled** (red)
- New requests default to "Draft"
- Status is persisted in state and shown as a color-coded badge on list cards
- Pushed to Airtable on every push (both create and update)
- **Approved and Shipped requests cannot be deleted** — Delete button is hidden on both list cards and editor bar; status change back re-enables deletion

## Push to Airtable
- **Manual only** — triggered by explicit "Push to Airtable" button in editor bar
- First push auto-creates `Reorder Requests` and `Reorder Line Items` tables if they don't exist
- Subsequent pushes update existing Airtable records (tracked via stored record IDs per request/item)
- Status is always synced to Airtable on push
- Deleted items: orphaned Airtable line item records are cleaned up on re-push
- Stale record IDs: if Airtable records were deleted externally, push auto-detects `ROW_DOES_NOT_EXIST` and re-creates instead of failing
- Batches writes in groups of 10 (Airtable API limit)
- "Synced" indicator shown on list cards for pushed requests

## Key Logic
- Dynamic N shipments (add/remove via UI). Each shipment has: id, method (AIR/SEA), destination, label, description
- Items store units per shipment in a `units` map: `{shipmentId: qty}`
- Shipments stored as array in state; old 2-shipment format auto-migrated on load
- Pieces = Units × Pack Quantity
- Cost RMB = Pieces × Cost per piece
- Est. Cost USD = Cost RMB × Exchange Rate (editable per request; defaults to live rate from open.er-api.com/v6/latest/CNY, fallback 0.1381; "Fetch Live" button to refresh; sanity check rejects rates outside 0.05–0.30)
- Total Order Summary combines same ASINs across shipments — displayed FIRST in both views (highlighted purple), followed by "SHIPMENT PLANS" section header, then individual shipments
- Both views are generated from the same underlying data
- All views (Sir Ohad, Supplier, Summary) auto-refresh whenever items are added, removed, or edited

## Excel Styling
- **Font**: Lexend throughout
- **Shipment colors cycle**: Green (#27AE60), Purple (#7D3C98), Orange (#E67E22), Blue (#2980B9), Red (#C0392B), Teal (#16A085), Violet (#8E44AD), Gold (#D4AC0D)
- **Total Order Summary**: Purple header (#7D3C98), light purple background (#F5F0FF), purple grand total (#E0CFF0) — shown FIRST in views, before shipment plans
- Title block: large bold, gray subtitle/date
- Data rows: thin borders, number formatting (#,##0 / #,##0.00)
- Subtotal: light gray bg, bold. Grand Total: light blue bg, bold.

## Known Gotchas
- Airtable API returns fields keyed by **field name** (e.g., `"Product Name"`), not field ID — lookup code must use names to read response
- When creating Airtable tables via API, the first field in the array becomes the primary field — it must be a text type (not linked records)
- Airtable table IDs are cached in localStorage (`airtable_reorder_tables`); if tables are deleted in Airtable, clear this key to force re-creation
- New fields (`Shipments Config`, `Units By Shipment`) are auto-added to existing Airtable tables on first push after upgrade (via `ensureFieldExists`); cached with `fieldsUpgraded` flag
- Push auto-recovers from deleted Airtable records: if a request or line item record was deleted in Airtable but the local app still holds its record ID, the push detects the `ROW_DOES_NOT_EXIST` 422 error and re-creates the record instead of failing

## Reference Samples
- Sir Ohad format: `C:\Users\User\Downloads\Sir Ohad View.xlsx`
- Supplier format: `C:\Users\User\Downloads\2026-Mar 6 - DOT 3.5mm Reorder - Shipment Plan.xlsx`

