---
name: backend-api-spec
description: API specification and module responsibilities for the Remote Pharmacy Medication Tracker. Use when implementing new API endpoints, understanding module ownership, or referencing the system schema design.
---

# API Specification & Module Ownership

## System Modules

### 1. Medication Request Management (Tharusha)
- Prefix: `/api/requests`
- Handles customer medication requests lifecycle
- Key endpoints: CRUD, status updates, user/pharmacy filtering, urgent requests
- Third-party: Twilio SMS / SendGrid Email for notifications

### 2. Pharmacy Inventory Management (Lahiru)
- Prefix: `/api/inventory`
- Tracks medications, stock levels, expiry dates
- Key endpoints: CRUD, low-stock alerts, expiring meds, search, bulk CSV upload
- Third-party: FDA Drug Database / RxNorm API for drug validation

### 3. Order & Delivery Management (Rajika)
- Prefix: `/api/orders`
- Converts approved requests to orders, delivery tracking, payments
- Key endpoints: CRUD, status, tracking, invoices, payment, delivery assignment
- Third-party: Stripe / PayPal for payment processing

### 4. Pharmacy Management (Thilina)
- Prefix: `/api/pharmacies`
- Pharmacy profiles, location-based search, reviews
- Key endpoints: CRUD, nearby search, verification, reviews, operating hours
- Third-party: Google Maps Geocoding & Distance Matrix API

### 5. User Management & Auth (Shared)
- Prefix: `/api/auth`, `/api/users`
- Registration, login, JWT auth, profile management
- Already implemented in initial setup

### 6. Notifications (Shared)
- Prefix: `/api/notifications`
- In-app, email, SMS notifications

### 7. Analytics (Shared)
- Prefix: `/api/analytics`
- Dashboard, revenue, popular medications, performance metrics

## Database Collections

| Collection | Description |
|------------|-------------|
| Users | Accounts & authentication |
| Pharmacies | Pharmacy profiles |
| Inventory | Medication inventory |
| Requests | Customer medication requests |
| Orders | Confirmed orders + delivery |
| Reviews | Pharmacy reviews |
| Notifications | User notifications |
| RefreshTokens | JWT refresh token storage |

## Standard Response Format

### Success
```json
{
  "success": true,
  "message": "Description",
  "data": { }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  }
}
```

## HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 500 | Internal Server Error |

## Adding a New Module Checklist

1. Create model in `models/` with Mongoose schema + TypeScript interface
2. Create Zod validators in `validators/`
3. Create service in `services/` with business logic
4. Create controller in `controllers/`
5. Create routes in `routes/` with Swagger JSDoc
6. Register routes in `routes/index.ts`
7. Add any new env vars to `config/env.ts` schema and `.env.example`
