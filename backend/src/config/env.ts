import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// SECURITY FIX (Weak Cryptographic Secret Management — see SECURITY.md #3):
// The original schema only required JWT secrets to be non-empty
// (`z.string().min(1, ...)`), so a one-character secret — or the
// low-entropy placeholder values shipped in .env.example /
// .env ("dev-access-secret-change-me-in-production-abc123") — would pass
// validation and could end up running in production. Weak/guessable JWT
// signing secrets let an attacker forge valid access tokens (impersonate
// any user, including System Admin) once they learn or brute-force the
// secret. We now enforce a minimum length (32 chars ≈ 256 bits when using a
// hex/base64 secret) and explicitly reject a short-list of known example
// values that must never be used outside local docs.
const KNOWN_WEAK_SECRETS = new Set([
  'your-access-secret-key-change-in-production',
  'your-refresh-secret-key-change-in-production',
  'dev-access-secret-change-me-in-production-abc123',
  'dev-refresh-secret-change-me-in-production-xyz789',
  'secret',
  'changeme',
]);

const strongSecret = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .min(32, `${label} must be at least 32 characters long for adequate entropy`)
    .refine(
      (value) => !KNOWN_WEAK_SECRETS.has(value),
      `${label} is a known placeholder value — generate a unique secret (e.g. 'openssl rand -hex 32') before deploying`
    );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  JWT_ACCESS_SECRET: strongSecret('JWT access secret'),
  JWT_REFRESH_SECRET: strongSecret('JWT refresh secret'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('100'),
  AUTH_RATE_LIMIT_WINDOW_MS: z.string().default('600000'),
  AUTH_RATE_LIMIT_MAX: z.string().default('10'),
  STRIPE_SECRET_KEY: z.string().default('sk_test_mock_key'),
  GOOGLE_MAPS_API_KEY: z.string().default('mock-google-maps-key'),
  RXNORM_API_BASE_URL: z.string().default('mock'),
  // OAuth / OpenID Connect (Google) — see SECURITY.md "New Feature: Sign in
  // with Google". Optional so the app still boots without them configured;
  // the OAuth routes themselves return a clear error if a request reaches
  // them while unconfigured.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
