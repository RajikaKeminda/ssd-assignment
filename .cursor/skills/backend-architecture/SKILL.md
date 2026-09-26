---
name: backend-architecture
description: Backend architecture guide for the Remote Pharmacy Medication Tracker. Use when creating new modules, routes, controllers, services, models, middlewares, or validators in the backend. Covers project structure, conventions, and patterns.
---

# Backend Architecture Guide

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Auth**: JWT (access + refresh token rotation), bcrypt (10 rounds)
- **Validation**: Zod schemas
- **Docs**: Swagger (swagger-jsdoc + swagger-ui-express)
- **Logging**: Winston
- **Security**: Helmet, CORS, express-rate-limit

## Project Structure

```
backend/src/
├── config/           # Environment, database, swagger config
├── controllers/      # Request handlers (thin - delegate to services)
├── middlewares/       # Auth, RBAC, validation, error handling
├── models/           # Mongoose schemas and interfaces
├── routes/           # Express route definitions + Swagger JSDoc
├── services/         # Business logic layer
├── types/            # TypeScript type augmentations
├── utils/            # Shared utilities (ApiError, ApiResponse, logger)
├── validators/       # Zod validation schemas
└── server.ts         # Entry point
```

## Conventions

### Adding a New Feature Module

1. **Model** (`models/<name>.model.ts`): Mongoose schema + TypeScript interface
2. **Validator** (`validators/<name>.validator.ts`): Zod schemas for input validation
3. **Service** (`services/<name>.service.ts`): Business logic, DB operations
4. **Controller** (`controllers/<name>.controller.ts`): Thin handler, delegates to service
5. **Route** (`routes/<name>.routes.ts`): Route definitions + Swagger JSDoc comments
6. **Register route** in `routes/index.ts`

### Controller Pattern

```typescript
import { Request, Response, NextFunction } from 'express';
import { SomeService } from '../services/some.service';
import { ApiResponse } from '../utils/api-response';

export class SomeController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SomeService.create(req.body);
      ApiResponse.created(res, result, 'Created successfully');
    } catch (error) {
      next(error);
    }
  }
}
```

### Service Pattern

```typescript
import { ApiError } from '../utils/api-error';

export class SomeService {
  static async create(data: CreateInput) {
    const existing = await Model.findOne({ field: data.field });
    if (existing) throw ApiError.conflict('Already exists');
    return Model.create(data);
  }
}
```

### Zod Validator Pattern

```typescript
import { z } from 'zod';

export const createSchema = z.object({
  body: z.object({
    field: z.string({ required_error: 'Field is required' }).min(1),
  }),
});

export type CreateInput = z.infer<typeof createSchema>['body'];
```

### Route with Middleware

```typescript
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { UserRole } from '../models/user.model';

const router = Router();
router.post('/', authenticate, authorize(UserRole.PHARMACY_STAFF), validate(schema), Controller.create);
```

### Error Handling

Always use `ApiError` static methods:
- `ApiError.badRequest(msg)` — 400
- `ApiError.unauthorized(msg)` — 401
- `ApiError.forbidden(msg)` — 403
- `ApiError.notFound(msg)` — 404
- `ApiError.conflict(msg)` — 409
- `ApiError.validationError(details)` — 400 with field-level details
- `ApiError.internal(msg)` — 500

### Response Format

All responses use `ApiResponse`:
```typescript
ApiResponse.success(res, data, 'Message');      // 200
ApiResponse.created(res, data, 'Message');       // 201
ApiResponse.error(res, statusCode, msg, code);   // Error
```

### User Roles

Three strictly defined roles:
- `Patient` — End users requesting medications
- `Pharmacy Staff` — Pharmacy administrators managing inventory/orders
- `System Admin` — Full system access

Access the enum via `UserRole.PATIENT`, `UserRole.PHARMACY_STAFF`, `UserRole.SYSTEM_ADMIN`.

### Swagger Documentation

Add JSDoc comments directly above route definitions in route files. See `routes/auth.routes.ts` for examples.

## Environment Variables

Copy `.env.example` to `.env` and fill in values. All env vars are validated at startup via Zod in `config/env.ts`.

## Running

```bash
npm run dev     # Development with hot reload
npm run build   # Compile TypeScript
npm start       # Run compiled output
```
