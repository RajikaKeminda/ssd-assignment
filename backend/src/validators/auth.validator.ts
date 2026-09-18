import { z } from 'zod';
import { UserRole } from '../models/user.model';

// SECURITY FIX (Privilege Escalation via Mass Assignment — see SECURITY.md #2):
// `role` used to be accepted straight from the public request body and passed
// through to User.create(), so anyone could POST /auth/register with
// { "role": "System Admin" } and be granted full admin rights on their own
// account — no approval, no verification. Public self-registration now ONLY
// ever creates a Patient account; `role` is no longer a field this schema
// accepts at all, so any role sent by a client is stripped by Zod before it
// ever reaches AuthService.register (which also hardcodes the role, in case
// a caller bypasses validation entirely — defense in depth).
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters')
      .trim(),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/,
        'Password must contain at least one uppercase, one lowercase, one number, and one special character'
      ),
    phone: z
      .string()
      .regex(/^\+?[\d\s-()]{7,15}$/, 'Invalid phone number format')
      .optional(),
  }),
});

/**
 * SECURITY FIX (Privilege Escalation — see SECURITY.md #2):
 * Non-patient accounts (Pharmacy Staff, Delivery Partner, System Admin) can
 * now only be created through POST /auth/staff, which is itself locked down
 * to authenticated System Admins (see auth.routes.ts). This lets `role` stay
 * a controlled, privileged field instead of user-supplied input.
 */
export const registerStaffSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters')
      .trim(),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/,
        'Password must contain at least one uppercase, one lowercase, one number, and one special character'
      ),
    role: z.enum(
      [UserRole.PHARMACY_STAFF, UserRole.DELIVERY_PARTNER, UserRole.SYSTEM_ADMIN],
      {
        errorMap: () => ({
          message: `Role must be one of: ${UserRole.PHARMACY_STAFF}, ${UserRole.DELIVERY_PARTNER}, ${UserRole.SYSTEM_ADMIN}`,
        }),
      }
    ),
    phone: z
      .string()
      .regex(/^\+?[\d\s-()]{7,15}$/, 'Invalid phone number format')
      .optional(),
    pharmacyId: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  }),
});

// SECURITY FIX (see SECURITY.md #5): the refresh token now travels primarily
// as an httpOnly cookie set by login/register/refresh, so it's no longer
// required in the body — AuthController.refreshToken/logout fall back to
// the body only for non-browser clients that can't use cookies, and reject
// the request if neither is present.
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1).optional(),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type RegisterStaffInput = z.infer<typeof registerStaffSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
