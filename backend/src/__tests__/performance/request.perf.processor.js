// Artillery processor for Request Medication performance tests
// This script provides dynamic data generation and test setup

const { MongoClient } = require('mongodb');

let db;
let client;

// Initialize database connection
async function initDB() {
  if (!db) {
    client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/medication-tracker-test');
    await client.connect();
    db = client.db();
  }
}

// Generate random medication names
const medicationNames = [
  'Amoxicillin 500mg',
  'Ibuprofen 400mg',
  'Paracetamol 500mg',
  'Cetirizine 10mg',
  'Loratadine 10mg',
  'Omeprazole 20mg',
  'Metformin 500mg',
  'Atorvastatin 20mg',
  'Amlodipine 5mg',
  'Losartan 50mg'
];

const urgencyLevels = ['urgent', 'normal', 'low'];
const notes = [
  'Patient needs this medication urgently',
  'Regular prescription refill',
  'First time prescription',
  'Chronic condition medication',
  'Temporary medication requirement'
];

// Function to generate random request data
function generateRequestData() {
  return {
    pharmacyId: process.env.PERF_PHARMACY_ID || '60d5ec49f1b2c72b1c8d1234',
    medicationName: medicationNames[Math.floor(Math.random() * medicationNames.length)],
    quantity: Math.floor(Math.random() * 50) + 1,
    urgencyLevel: urgencyLevels[Math.floor(Math.random() * urgencyLevels.length)],
    prescriptionRequired: Math.random() > 0.7,
    notes: notes[Math.floor(Math.random() * notes.length)]
  };
}

// Function to get a random request ID from database
async function getRandomRequestId() {
  await initDB();
  const requests = await db.collection('requests').find({}).toArray();
  if (requests.length === 0) {
    return process.env.PERF_REQUEST_ID || '60d5ec49f1b2c72b1c8d4567';
  }
  const randomRequest = requests[Math.floor(Math.random() * requests.length)];
  return randomRequest._id.toString();
}

// Function to get a random user ID from database
async function getRandomUserId() {
  await initDB();
  const users = await db.collection('users').find({ role: 'Patient' }).toArray();
  if (users.length === 0) {
    return process.env.PERF_USER_ID || '60d5ec49f1b2c72b1c8d1234';
  }
  const randomUser = users[Math.floor(Math.random() * users.length)];
  return randomUser._id.toString();
}

// Function to get a random pharmacy ID from database
async function getRandomPharmacyId() {
  await initDB();
  const pharmacies = await db.collection('pharmacies').find({}).toArray();
  if (pharmacies.length === 0) {
    return process.env.PERF_PHARMACY_ID || '60d5ec49f1b2c72b1c8d1234';
  }
  const randomPharmacy = pharmacies[Math.floor(Math.random() * pharmacies.length)];
  return randomPharmacy._id.toString();
}

// Artillery processor functions
module.exports = {
  // Generate request data for POST requests
  generateRequestData: function(context, events, done) {
    context.vars.requestData = generateRequestData();
    return done();
  },

  // Get random request ID
  getRandomRequestId: async function(context, events, done) {
    try {
      const requestId = await getRandomRequestId();
      context.vars.requestId = requestId;
      return done();
    } catch (error) {
      console.error('Error getting random request ID:', error);
      context.vars.requestId = process.env.PERF_REQUEST_ID || '60d5ec49f1b2c72b1c8d4567';
      return done();
    }
  },

  // Get random user ID
  getRandomUserId: async function(context, events, done) {
    try {
      const userId = await getRandomUserId();
      context.vars.userId = userId;
      return done();
    } catch (error) {
      console.error('Error getting random user ID:', error);
      context.vars.userId = process.env.PERF_USER_ID || '60d5ec49f1b2c72b1c8d1234';
      return done();
    }
  },

  // Get random pharmacy ID
  getRandomPharmacyId: async function(context, events, done) {
    try {
      const pharmacyId = await getRandomPharmacyId();
      context.vars.pharmacyId = pharmacyId;
      return done();
    } catch (error) {
      console.error('Error getting random pharmacy ID:', error);
      context.vars.pharmacyId = process.env.PERF_PHARMACY_ID || '60d5ec49f1b2c72b1c8d1234';
      return done();
    }
  },

  // Generate random status update data
  generateStatusUpdateData: function(context, events, done) {
    const validTransitions = {
      'pending': ['processing', 'unavailable', 'cancelled'],
      'processing': ['available', 'unavailable', 'cancelled'],
      'available': ['fulfilled', 'cancelled'],
      'unavailable': ['cancelled']
    };
    
    const statuses = Object.keys(validTransitions);
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const possibleNext = validTransitions[randomStatus];
    const nextStatus = possibleNext[Math.floor(Math.random() * possibleNext.length)];
    
    context.vars.statusUpdateData = {
      status: nextStatus,
      notes: `Performance test status update to ${nextStatus}`
    };
    return done();
  },

  // Cleanup function to close database connection
  cleanup: async function() {
    if (client) {
      await client.close();
    }
  }
};
