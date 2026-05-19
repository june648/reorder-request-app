/*
 * Weekly Delivery Sync — Airtable Automation Script
 * ====================================================
 *
 * Cross-app integration between:
 *   - SCM Shipment Tracker  (writes Shipment statuses)
 *   - Re-Order Request App  (reads result, flips Re-order Status to "Delivered")
 *
 * Behavior
 * --------
 * For every Re-order Request whose current Status is "Approved" or "Shipped":
 *   - Find all Shipments where Reorder_Ref contains its Reference ID
 *     (Reorder_Ref is comma-separated, e.g. "SCM0000005, SCM0000004")
 *   - If ALL those shipments are CLOSED_FULLY_RECEIVED or CLOSED_WITH_DISCREPANCY:
 *       → Set Re-order Status to "Delivered"
 *       → Append an audit line to Notes:
 *         "Auto-marked Delivered on YYYY-MM-DD — all N shipments closed (SHIP-001, SHIP-002)"
 *
 * Re-orders with no linked shipments are left alone.
 * Re-orders with at least one still-in-transit shipment are left alone.
 *
 * Setup (one-time)
 * ----------------
 * 1. Open base appIi4INnoNSh9kru in Airtable.
 * 2. Click "Automations" (top bar) → "Create automation".
 * 3. Name it: "Weekly Delivery Sync — Friday 3 PM Manila".
 * 4. Trigger: "At a scheduled time"
 *      - Frequency: Weekly
 *      - Day: Friday
 *      - Time: 3:00 PM
 *      - Timezone: Asia/Manila  (UTC+8)
 * 5. Action: "Run script"
 *      - Paste the entire script body below (everything after the comment block).
 *      - No input variables needed — the script reads tables by name.
 * 6. Click "Test" once. Expected: console log of how many re-orders would update
 *    (set DRY_RUN = true on first run to preview without writing).
 * 7. Turn the automation ON.
 *
 * Safety
 * ------
 * - DRY_RUN = true at the top disables writes — use for first test.
 * - Only flips Approved/Shipped re-orders (never overwrites Draft/For Approval/
 *   Cancelled/Delivered).
 * - Notes are appended, never overwritten.
 *
 * Schema dependencies
 * -------------------
 * Reorder Requests table needs: Reference ID, Status (with "Delivered" choice), Notes
 * Shipments table needs: Reorder_Ref, Status, ShipmentRequest_ID
 *
 * Both apps already use the same base (appIi4INnoNSh9kru). The "Delivered" status
 * choice was added to Reorder Requests on 2026-05-19 alongside this script.
 *
 * To modify behavior, edit this file and re-paste into the Airtable Automation.
 * Airtable does not auto-sync from Git — this file is the source of truth, the
 * pasted copy is the runtime.
 */

// === Begin script — copy from here into Airtable ===

const DRY_RUN = false;

const RECEIVED_STATUSES = new Set([
    'CLOSED_FULLY_RECEIVED',
    'CLOSED_WITH_DISCREPANCY',
]);

const ELIGIBLE_REORDER_STATUSES = new Set(['Approved', 'Shipped']);

const shipmentsTable = base.getTable('Shipments');
const reordersTable = base.getTable('Reorder Requests');

const shipmentsQuery = await shipmentsTable.selectRecordsAsync({
    fields: ['Reorder_Ref', 'Status', 'ShipmentRequest_ID'],
});

const refMap = new Map();
for (const rec of shipmentsQuery.records) {
    const refField = rec.getCellValueAsString('Reorder_Ref') || '';
    const status = rec.getCellValueAsString('Status') || '';
    const shipId = rec.getCellValueAsString('ShipmentRequest_ID') || rec.id;
    if (!refField) continue;

    const refs = refField.split(',').map(s => s.trim()).filter(Boolean);
    for (const ref of refs) {
        if (!refMap.has(ref)) {
            refMap.set(ref, { total: 0, received: 0, shipmentIds: [] });
        }
        const entry = refMap.get(ref);
        entry.total += 1;
        entry.shipmentIds.push(shipId);
        if (RECEIVED_STATUSES.has(status)) {
            entry.received += 1;
        }
    }
}

const reordersQuery = await reordersTable.selectRecordsAsync({
    fields: ['Reference ID', 'Status', 'Notes'],
});

const today = new Date().toISOString().slice(0, 10);
const updates = [];
const skippedNoLink = [];
const skippedInTransit = [];

for (const rec of reordersQuery.records) {
    const refId = rec.getCellValueAsString('Reference ID');
    const currentStatus = rec.getCellValueAsString('Status');
    if (!refId) continue;
    if (!ELIGIBLE_REORDER_STATUSES.has(currentStatus)) continue;

    const entry = refMap.get(refId);
    if (!entry || entry.total === 0) {
        skippedNoLink.push(refId);
        continue;
    }
    if (entry.received < entry.total) {
        skippedInTransit.push(`${refId} (${entry.received}/${entry.total})`);
        continue;
    }

    const existingNotes = rec.getCellValueAsString('Notes') || '';
    const plural = entry.total === 1 ? '' : 's';
    const noteLine = `Auto-marked Delivered on ${today} — all ${entry.total} shipment${plural} closed (${entry.shipmentIds.join(', ')})`;
    const newNotes = existingNotes ? `${existingNotes}\n${noteLine}` : noteLine;

    updates.push({
        id: rec.id,
        fields: {
            'Status': { name: 'Delivered' },
            'Notes': newNotes,
        },
    });
}

console.log(`Re-orders eligible for auto-Delivered: ${updates.length}`);
console.log(`Skipped (no linked shipments): ${skippedNoLink.length}`);
console.log(`Skipped (still in transit): ${skippedInTransit.length}`);
if (skippedInTransit.length) console.log(' in-transit details:', skippedInTransit.join('; '));
if (updates.length) console.log(' will update:', updates.map(u => u.fields.Status.name + ' → ' + (reordersQuery.getRecord(u.id).getCellValueAsString('Reference ID'))).join(', '));

if (DRY_RUN) {
    console.log('DRY_RUN is true — no writes performed.');
} else {
    while (updates.length > 0) {
        const batch = updates.splice(0, 50);
        await reordersTable.updateRecordsAsync(batch);
    }
    console.log('Done.');
}

// === End script ===
