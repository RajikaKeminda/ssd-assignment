/* eslint-disable @typescript-eslint/no-var-requires */
const http = require('http');

/**
 * Artillery processor for order performance tests.
 *
 * Before running:
 *  1. Start the server:         npm run dev
 *  2. Seed test data:           node src/__tests__/performance/seed-perf-data.js
 *  3. Set env vars listed below (or edit the defaults)
 *
 * Required env vars (or change defaults below):
 *   PERF_PATIENT_TOKEN  — JWT for a Patient user
 *   PERF_STAFF_TOKEN    — JWT for a Pharmacy Staff user
 *   PERF_ORDER_ID       — A valid order _id
 *   PERF_USER_ID        — A valid user _id
 *   PERF_PHARMACY_ID    — A valid pharmacy _id
 */

const PATIENT_TOKEN = process.env.PERF_PATIENT_TOKEN || 'REPLACE_WITH_PATIENT_JWT';
const STAFF_TOKEN = process.env.PERF_STAFF_TOKEN || 'REPLACE_WITH_STAFF_JWT';
const ORDER_ID = process.env.PERF_ORDER_ID || 'REPLACE_WITH_ORDER_ID';
const USER_ID = process.env.PERF_USER_ID || 'REPLACE_WITH_USER_ID';
const PHARMACY_ID = process.env.PERF_PHARMACY_ID || 'REPLACE_WITH_PHARMACY_ID';

module.exports = {
  setupTestData,
  setPatientAuth,
  setStaffAuth,
};

function setupTestData(requestParams, ctx, ee, next) {
  ctx.vars.patientToken = PATIENT_TOKEN;
  ctx.vars.staffToken = STAFF_TOKEN;
  ctx.vars.orderId = ORDER_ID;
  ctx.vars.userId = USER_ID;
  ctx.vars.pharmacyId = PHARMACY_ID;
  return next();
}

function setPatientAuth(requestParams, ctx, ee, next) {
  ctx.vars.patientToken = PATIENT_TOKEN;
  ctx.vars.orderId = ORDER_ID;
  ctx.vars.userId = USER_ID;
  return next();
}

function setStaffAuth(requestParams, ctx, ee, next) {
  ctx.vars.staffToken = STAFF_TOKEN;
  ctx.vars.pharmacyId = PHARMACY_ID;
  ctx.vars.orderId = ORDER_ID;
  return next();
}
