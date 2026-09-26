---
name: backend-auth
description: Authentication and authorization implementation details for the medication tracker backend. Use when working with JWT tokens, refresh token rotation, RBAC middleware, login/register flows, or protecting routes.
---

# Authentication & Authorization

## Authentication Flow

### Registration
`POST /api/auth/register` — Creates user, hashes password (bcrypt 10 rounds), returns access + refresh tokens.

### Login
`POST /api/auth/login` — Validates credentials, updates `lastLogin`, returns token pair.

### Token Refresh (Rotation)
`POST /api/auth/refresh` — Accepts old refresh token, revokes it, issues new pair. If a revoked token is reused, all user tokens are revoked (replay attack protection).

### Logout
`POST /api/auth/logout` — Revokes the provided refresh token.

## Token Architecture

| Token | Storage | Expiry | Secret |
|-------|---------|--------|--------|
| Access Token | Client memory / Authorization header | 15m (configurable) | `JWT_ACCESS_SECRET` |
| Refresh Token | DB (`RefreshToken` collection) + client | 7d (configurable) | Random 40-byte hex |

### Access Token Payload
```json
{ "userId": "string", "role": "Patient|Pharmacy Staff|System Admin" }
```

## Protecting Routes

### Authentication Only
```typescript
import { authenticate } from '../middlewares/auth.middleware';
router.get('/profile', authenticate, Controller.getProfile);
```

### Authentication + Role Check
```typescript
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { UserRole } from '../models/user.model';

router.delete('/users/:id',
  authenticate,
  authorize(UserRole.SYSTEM_ADMIN),
  Controller.deleteUser
);
```

### Multiple Roles
```typescript
router.get('/orders',
  authenticate,
  authorize(UserRole.PATIENT, UserRole.PHARMACY_STAFF),
  Controller.getOrders
);
```

## Key Files

| File | Purpose |
|------|---------|
| `models/user.model.ts` | User schema, password hashing pre-save hook |
| `models/refresh-token.model.ts` | Refresh token storage with TTL index |
| `services/auth.service.ts` | JWT generation, verification, token rotation logic |
| `controllers/auth.controller.ts` | HTTP handlers for auth endpoints |
| `middlewares/auth.middleware.ts` | Extract & verify Bearer token, attach `req.user` |
| `middlewares/rbac.middleware.ts` | Role-based access control |
| `validators/auth.validator.ts` | Zod schemas for register, login, refresh |
| `routes/auth.routes.ts` | Route definitions with Swagger docs |

## Password Requirements

Enforced via Zod validator:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (`@$!%*?&#`)

## Security Considerations

- Passwords never returned in API responses (excluded in Mongoose `toJSON` transform)
- Refresh tokens stored in DB with expiry TTL index for auto-cleanup
- Token reuse detection: if a revoked refresh token is reused, all tokens for that user are invalidated
- Rate limiting applied globally (configurable via env vars)
