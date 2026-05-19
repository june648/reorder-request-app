# Re-Order Request App

## Overview
A single-page HTML app for managing re-order requests and shipment plans. Replaces manual Excel creation for two audiences:
- **Sir Ohad View**: Internal view with ASIN, Product, Units, Pieces, Number of Cartons, Cost RMB, Est. Cost USD
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
    - `Masterbox Quantity` (units per masterbox; used to compute total masterboxes in Sir Ohad view)
- **Reorder Requests Table** (auto-created on first push) — master request records
  - Fields: Reference ID, Title, Subtitle, Date, Shipments Config (JSON), S1/S2 Method/Destination/Description (backward compat), S1–S10 Name (shipment labels), Total Items/Units/Pieces, Total Cost RMB/USD, Exchange Rate, Status (Draft/For Approval/Approved), Notes
- **Reorder Line Items Table** (auto-created on first push) — individual product rows, linked to parent request
  - Fields: Reference ID (primary), Request (linked record), ASIN, Product Name, UPC, FNSKU, Yun Description, Type (Catalog/New Product), Pack Qty, Masterbox Qty, Cost Per Piece RMB, Units By Shipment (JSON), S1–S10 Units, Total Units, Total Pieces, Cost RMB, Cost USD
- Table IDs cached in localStorage under `airtable_reorder_tables` key
- User's Airtable PAT stored in localStorage (configured via Settings gear icon)

## Branding
- Full-width blue header bar (#3a5bc7) with Seattle Cell Market logo (white filter), divider, app title, "Internal Tools" subtitle
- Logo file: `logo.png` in root and `public/` directories (sourced from SCM Dashboard project)
- Top bar sits outside the `.app` container to span full viewport width

## App Structure
- **List Screen**: Shows all saved re-order requests as cards (title, date, item/unit/piece counts). "+ New Request" button to create. Click a card to open it. Delete button per card (hidden for Approved/Shipped requests). Below the request list is an **ASIN Summary** section (collapsible, blue header) aggregating every item across all local requests — columns: ASIN, Description, Qty (Units), Request ID, Status. Supports text filter, status dropdown filter, and sortable columns (default sort by status). Click a row to jump into that request.
- **Editor Screen**: Opened when a request is selected. Has Back/Save/Delete buttons (Delete hidden when Approved/Shipped) and a Status dropdown in a top bar.
  - **Data Entry tab**: Shipment config (add/remove shipments, method, destination, description) + item table. Pack Qty is read-only (pulled from Airtable). Exchange rate field in header (editable, with "Fetch Live" button, saved per request).
  - **Sir Ohad View tab**: Formatted view with costs, subtotals, grand total — downloadable as Excel. Includes a **Number of Cartons** column (between Pieces and Cost in RMB) showing total master cartons per item, computed as `units / masterboxQty` (the underlying Airtable field is still `Masterbox Quantity`). Column appears in both Total Order Summary and every per-shipment subtable; Supplier view stays unchanged.
  - **Supplier View tab**: Formatted view without costs — downloadable as Excel
  - **Summary tab**: Overview cards, shipment breakdown, notes
- **Load from Airtable**: Fetches requests from Airtable. Auto-syncs already-imported requests silently (overwrites local state with latest Airtable data, preserving linked record IDs) — so changes pushed from another device propagate on the next Load. Shows a "synced N existing" count and lists only the not-yet-imported remote requests with "Import" buttons. Clicking an un-imported card shows a read-only detail view (`viewAirtableRequest`) with an "Import to Local & Edit" button. The read-only preview matches the Sir Ohad View column set including **Number of Cartons** — for older line items missing the `Masterbox Qty` field, it falls back to a single batched OR-filter lookup against Products Catalog so carton counts display correctly without re-import. Once imported, the request appears as a normal local card. Shared helper `buildStateFromAirtable(reqRecord, itemRecords)` powers both import and silent sync.
- **Navigation**: Back button returns to list, auto-saves current request. Multiple requests stored in localStorage under `reorder_requests` key (array of {id, refId, createdAt, state, airtableRequestRecordId, airtableLineItemRecordIds, lastPushedAt}).

## Item Types
Each item row has a **Type** dropdown (first column):
- **Catalog**: Default. Enter ASIN → auto-pulls Product Name, UPC, FNSKU, Pack Qty, Cost/pc from Airtable. These fields are read-only.
- **New Product**: For products not yet assigned an ASIN. ASIN field is disabled. Product Name, UPC, FNSKU, Pack Qty are all manually editable.
  - **UPC lookup**: If the product already exists in the Airtable catalog (without an ASIN), user can type the UPC and click the **🔍 Lookup** button below the UPC field (or wait for debounced auto-trigger) to auto-fill Product Name, FNSKU, Pack Qty, Cost/pc, and Yun Description from Airtable. Implemented via `lookupUPC(upc, rowId)` and `triggerUpcLookup(rowId)`. Formula uses `{UPC}&""="..."` cast so it matches whether UPC is stored as text or number in Airtable, plus leading-zero variants and a `FIND` substring fallback.
- The `type` field (`'catalog'` or `'new'`) is persisted per item. Existing saved items without a type default to `'catalog'`.

## Reference ID
- Format: `SCM0000001` — sequential 7-digit zero-padded number
- Auto-generated on new request creation, assigned retroactively to older requests on open
- `generateRefId()` checks both local requests AND cached Airtable ref IDs (`knownAirtableRefIds`) to avoid collisions — user must "Load from Airtable" at least once before creating new requests on a fresh origin
- Duplicate ref IDs in Airtable are auto-detected and fixed during "Load from Airtable" (`fixDuplicateAirtableRefIds`) — newer duplicate records get reassigned to the next available ID, including their line items
- Displayed as badge on list cards and in editor bar
- Pushed to Airtable as the key identifier for both request and line item records

## Status
- Dropdown in editor bar with six values: **Draft** (yellow), **For Approval** (blue), **Approved** (green), **Shipped** (purple), **Delivered** (teal — FBA/warehouse received the items), **Cancelled** (red)
- New requests default to "Draft"
- Status is persisted in state and shown as a color-coded badge on list cards
- Pushed to Airtable on every push (both create and update)
- **Approved, Shipped, and Delivered requests cannot be deleted** (defined in `PROTECTED_STATUSES`) — Delete button is hidden on both list cards and editor bar; status change back re-enables deletion
- **Auto-Delivered sync**: an Airtable Automation (`airtable-automations/weekly-delivery-sync.js`) runs Friday 3 PM Manila time. It scans the SCM Shipment Tracker's `Shipments` table for each Re-order's linked shipments (via `Reorder_Ref`) and, when all are `CLOSED_FULLY_RECEIVED` / `CLOSED_WITH_DISCREPANCY`, flips Status to Delivered and appends an audit line to Notes. Only flips Approved/Shipped re-orders. The .js file is the source of truth; the runtime copy lives inside the Airtable Automation — edits must be re-pasted.

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
- Masterboxes = Units ÷ Masterbox Quantity (only computed when masterboxQty > 0; via `calcMasterboxes()` in `shipmentItems()` and `totalItems()`)
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
- New fields (`Shipments Config`, `Units By Shipment`, `Masterbox Qty`) are auto-added to existing Airtable tables on first push after upgrade (via `ensureFieldExists`); cached with `fieldsUpgraded` and `masterboxFieldAdded` flags — bumping the gate flag forces re-check after schema upgrades
- All record create/update calls use `typecast: true` so Airtable auto-creates new singleSelect options (e.g., Shipped, Cancelled) without needing schema write permissions
- New select choices (Shipped, Cancelled) are also added via `ensureSelectChoices()` PATCH when schema write is available; cached with `statusChoicesV2` flag
- Push auto-recovers from deleted Airtable records: if a request or line item record was deleted in Airtable but the local app still holds its record ID, the push detects the `ROW_DOES_NOT_EXIST` 422 error and re-creates the record instead of failing

## Reference Samples
- Sir Ohad format: `C:\Users\User\Downloads\Sir Ohad View.xlsx`
- Supplier format: `C:\Users\User\Downloads\2026-Mar 6 - DOT 3.5mm Reorder - Shipment Plan.xlsx`

