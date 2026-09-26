/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Artillery processor for inventory performance tests.
 *
 * Before running:
 *  1. Start the server:         npm run dev
 *  2. Seed test data:           node src/__tests__/performance/seed-perf-data.js
 *  3. Set env vars listed below (or edit the defaults)
 *
 * Required env vars (or change defaults below):
 *   PERF_STAFF_TOKEN    — JWT for a Pharmacy Staff user
 *   PERF_INVENTORY_ID   — A valid inventory item _id
 *   PERF_PHARMACY_ID    — A valid pharmacy _id
 */

const STAFF_TOKEN = process.env.PERF_STAFF_TOKEN || 'REPLACE_WITH_STAFF_JWT';
const INVENTORY_ID = process.env.PERF_INVENTORY_ID || 'REPLACE_WITH_INVENTORY_ID';
const PHARMACY_ID = process.env.PERF_PHARMACY_ID || 'REPLACE_WITH_PHARMACY_ID';

module.exports = {
    setupTestData,
    setStaffAuth,
};

function setupTestData(requestParams, ctx, ee, next) {
    ctx.vars.staffToken = STAFF_TOKEN;
    ctx.vars.inventoryId = INVENTORY_ID;
    ctx.vars.pharmacyId = PHARMACY_ID;
    return next();
}

function setStaffAuth(requestParams, ctx, ee, next) {
    ctx.vars.staffToken = STAFF_TOKEN;
    ctx.vars.inventoryId = INVENTORY_ID;
    ctx.vars.pharmacyId = PHARMACY_ID;
    return next();
}
