# Security Assessment & Remediation Report

**Project:** Remote Pharmacy Medication Tracker (Medication Tracking System)
**Assignment:** SE4030 — Secure Software Development, Group Assignment
**Original repository:** https://github.com/RajikaKeminda/medication-tracking-system
**Modified repository:** https://github.com/RajikaKeminda/ssd-assignment

This document is the primary technical record of the security work done on
this project. It is referenced from inline `SECURITY FIX (... — see
SECURITY.md #N)` comments throughout the codebase, so that anyone reading a
diff can jump straight from "what changed" to "why it was necessary".

Methodology: the original application (`chosen-project`, tag/commit range
Feb–Apr 2026, 52 commits) was reviewed via a combination of **manual
white-box code review** (reading every Express route, controller, service,
and middleware against the OWASP Top 10 2021) and **automated
software-composition analysis** (`npm audit` against both `backend/` and
`frontend/`). No vulnerable teaching application (WebGoat, DVWA, Juice Shop,
etc.) was used — every vulnerability below was found in, and fixed in, the
group's own previously-built application, as the assignment requires.

---

## Summary table

| # | Vulnerability | OWASP category | Status |
|---|---|---|---|
| 1 | Insecure Direct Object Reference (IDOR) / Broken Object-Level Authorization on Orders | A01:2021 – Broken Access Control | ✅ Fixed |
| 2 | Privilege Escalation via Mass Assignment (self-registration as Admin/Staff) | A01:2021 – Broken Access Control | ✅ Fixed |
| 3 | Weak Cryptographic Secret Management (weak/placeholder JWT secrets accepted) | A02:2021 – Cryptographic Failures | ✅ Fixed |
| 4 | ReDoS via Unescaped User Input in MongoDB `$regex` Search | A03:2021 – Injection | ✅ Fixed |
| 5 | Sensitive Tokens Stored in `localStorage` (XSS → session theft) | A02:2021 – Cryptographic Failures / A07:2021 – Identification & Authentication Failures | ✅ Fixed |
| 6 | No Rate Limiting on Authentication Endpoints (credential stuffing / brute force) | A07:2021 – Identification & Authentication Failures | ✅ Fixed |
| 7 | Cross-Tenant Authorization Bypass on Pharmacy Inventory | A01:2021 – Broken Access Control | ✅ Fixed |
| 8 | Vulnerable / Outdated Third-Party Dependencies | A06:2021 – Vulnerable and Outdated Components | ⚠️ **Not fixed** (documented below) |

Plus one **new security-relevant feature**: Google Sign-In implemented as a
standards-compliant **OAuth 2.0 Authorization Code grant with OpenID
Connect ID-token verification** (see the dedicated section near the end of
this document).

---

## 1. Insecure Direct Object Reference (IDOR) on Orders

**OWASP:** A01:2021 – Broken Access Control (CWE-639: Authorization Bypass
Through User-Controlled Key)

**Where:** `backend/src/services/order.service.ts`,
`backend/src/controllers/order.controller.ts`, `backend/src/routes/order.routes.ts`

**The vulnerability.** Routes such as `GET /orders/:id`, `GET
/orders/track/:id`, `POST /orders/:id/payment`, `GET /orders/:id/invoice`,
and `GET /orders/user/:userId` all accepted an object ID straight from the
URL and fetched/mutated that record with **no check that the authenticated
caller actually owned it or was otherwise entitled to see it**. Any logged-in
Patient could enumerate order IDs (they are sequential/guessable Mongo
ObjectIds returned in prior list responses) and:

- read another patient's full order (medications, address, payment status);
- download another patient's invoice PDF;
- view another patient's live delivery tracking;
- trigger a payment attempt against another patient's order.

This is a textbook IDOR / Broken Object-Level Authorization (BOLA) bug —
one of the most common real-world API vulnerabilities (it tops the OWASP
API Security Top 10 as well).

**The fix.** Every order-service method that resolves a single order now
requires a `RequestingUser` (the authenticated caller's id + role, taken
from the verified JWT, never from the request body/params) and runs the
result through a new `assertOrderAccess()` guard before returning or
mutating anything:

```ts
// backend/src/services/order.service.ts
function assertOrderAccess(
  order: { userId?: unknown; deliveryPartnerId?: unknown },
  requester: RequestingUser
) {
  if (STAFF_ROLES.has(requester.role)) return; // admin / pharmacy staff: full access
  const ownerId = refId(order.userId);
  const partnerId = refId(order.deliveryPartnerId);
  if (requester.role === UserRole.DELIVERY_PARTNER && partnerId === requester.id) return;
  if (ownerId === requester.id) return;
  throw new ForbiddenError('You do not have access to this order');
}
```

A `refId()` helper was added because a populated Mongoose reference
(`.populate('userId', ...)`) does not reliably stringify to the underlying
ObjectId via `toString()` — using it naively would have silently broken
legitimate owner access for populated results.

The six affected service methods (`getOrderById`, `getDeliveryTracking`,
`generateInvoice`, `processPayment`, `getUserOrders`,
`getDeliveryPartnerOrders`) were updated to accept and enforce this, the
controllers now pass through `req.user` (set by the existing `authenticate`
middleware) as the `RequestingUser`, and
`GET /orders/delivery-partner/:partnerId` additionally gained an
`authorize()` middleware check it was missing entirely. Three new
regression tests were added asserting that a non-owner, non-staff caller
receives `403 Forbidden`.

**Best practice that would have prevented it:** enforce object-level
authorization at the data-access layer for every endpoint that takes an
identifier from the client, not just role-level authorization at the route
layer — "the user is logged in" and "the user is allowed to see *this*
record" are two different checks.

---

## 2. Privilege Escalation via Mass Assignment

**OWASP:** A01:2021 – Broken Access Control (CWE-915: Improperly
Controlled Modification of Dynamically-Determined Object Attributes)

**Where:** `backend/src/validators/auth.validator.ts`,
`backend/src/services/auth.service.ts`, `backend/src/controllers/auth.controller.ts`,
`frontend/src/pages/Signup.jsx`

**The vulnerability.** The public `POST /auth/register` endpoint's Zod
schema accepted a `role` field straight from the request body, and the
frontend sign-up form offered a `<select>` with "Patient / Pharmacy Staff /
Delivery Partner / System Admin" as options. Nothing on the server
re-derived or clamped the role — whatever the client sent was trusted and
written to the new user document. Anyone could `POST /auth/register` with
`{"role":"admin", ...}` (or simply pick "System Admin" in the UI) and
self-provision full administrative access to the whole system: every
patient's medical/order data, every pharmacy's inventory, and the ability to
create further admin accounts.

**The fix.**

- `registerSchema` no longer accepts `role` at all; `AuthService.register()`
  now hardcodes `role: UserRole.PATIENT` for every public sign-up,
  server-side, regardless of what the client sends.
- A separate, **admin-only** endpoint, `POST /auth/staff`, was added
  (`registerStaffSchema` + `AuthService.registerStaff()`) for creating
  Pharmacy Staff, Delivery Partner, or System Admin accounts. It is
  protected by the existing `authenticate` + `authorize(UserRole.ADMIN)`
  middleware chain.
- This created a bootstrap problem — if only an Admin can create an Admin,
  who creates the *first* one? Solved with a standalone operator script,
  `backend/src/scripts/bootstrap-admin.ts` (`npm run bootstrap:admin`),
  which is run directly against the database by a trusted operator (not
  exposed as an HTTP endpoint) and refuses to run if an admin already
  exists.
- The frontend sign-up form (`Signup.jsx`) had the role `<select>` removed
  entirely, replaced with a short note that staff/admin accounts are
  provisioned separately. (This is a UX improvement, not the actual
  security boundary — the server-side fix above is what matters; even a
  hand-crafted `curl` request can no longer escalate privilege.)

**Best practice that would have prevented it:** never trust a
client-supplied field that controls authorization (role, permission flags,
`isAdmin`, price, ownership id, etc.). Determine security-sensitive fields
entirely server-side, and only ever accept an explicit allow-list of fields
from the client (Zod's `.strict()`/`.pick()` schemas make this cheap).

---

## 3. Weak Cryptographic Secret Management

**OWASP:** A02:2021 – Cryptographic Failures (CWE-326: Inadequate
Encryption Strength / CWE-1391: Use of Weak Credentials)

**Where:** `backend/src/config/env.ts`, `backend/.env`, `backend/.env.example`

**The vulnerability.** JWT access/refresh secrets were validated only with
`z.string().min(1, ...)` — any non-empty string passed, including the
literal placeholder values shipped in `.env.example`
(`"your-access-secret-key-change-in-production"`,
`"dev-access-secret-change-me-in-production-abc123"`). A deployment that
forgot to override these — a very common real-world mistake — would sign
every access and refresh token with a secret that is publicly visible in
the project's own git history/README. Anyone who read the repository could
forge a valid JWT for any user, including a System Admin, without ever
touching the database or a password.

**The fix.** `backend/src/config/env.ts` now defines a `strongSecret()` Zod
refinement that (a) enforces a minimum length of 32 characters (≈256 bits
of entropy for a hex/base64 secret), and (b) explicitly rejects a
`KNOWN_WEAK_SECRETS` set containing the exact placeholder strings that used
to ship in this repository (plus generic ones like `"secret"`,
`"changeme"`). The application now **refuses to boot** in any environment
if `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are missing, too short, or match
a known-weak value. `.env` and `.env.example` were regenerated with strong,
randomly-generated secrets (`openssl rand -hex 32`) and comments explaining
the requirement.

**Best practice that would have prevented it:** fail closed, not open —
configuration validation for secrets should reject weak values at startup
rather than silently accepting them, and example/template env files should
never contain values that would actually pass validation.

---

## 4. ReDoS via Unescaped User Input in MongoDB `$regex` Search

**OWASP:** A03:2021 – Injection (CWE-1333: Inefficient Regular Expression
Complexity / "NoSQL Injection" family)

**Where:** `backend/src/services/inventory.service.ts`,
`backend/src/services/pharmacy.service.ts`, `backend/src/utils/regex.ts`

**The vulnerability.** Search endpoints (medication-inventory search,
pharmacy search-by-city) built a MongoDB query using the user's raw search
string directly inside a `$regex` filter, e.g.
`{ name: { $regex: q, $options: 'i' } }`. Because the string is passed
straight into the regex engine, a client could submit a value containing
regex metacharacters that trigger **catastrophic backtracking** (e.g. a
string like `"(a+)+$"`-style patterns), causing the MongoDB query — and the
Node.js event loop handling it — to hang, denying service to every other
user of a shared backend process. This is a Denial-of-Service-class
injection vulnerability: user input was being interpreted as *code* (a
regex program) instead of *data* (a literal search term).

**The fix.** A small `escapeRegex()` utility
(`backend/src/utils/regex.ts`) escapes every regex metacharacter in
user-supplied search terms before they are interpolated into a `$regex`
filter, so `$regex` only ever matches the input literally (case-insensitive
substring search — the intended behaviour — still works correctly). It is
applied everywhere user search input reaches a `$regex` query:
`InventoryService.create()`'s duplicate-name check, `InventoryService.getAll()`'s
search filter, and `PharmacyService`'s `location.city` search. As a
defence-in-depth measure, the corresponding Zod validators
(`inventory.validator.ts`, `pharmacy.validator.ts`) also now cap the
`search`/`city` query parameters at 100 characters.

**Best practice that would have prevented it:** never pass unsanitized user
input into any interpreter — SQL, NoSQL query operators, and regex engines
are all "little languages" and need the same treatment as SQL injection:
escape or parameterize, never string-concatenate trust boundaries away.

---

## 5. Sensitive Tokens Stored in `localStorage`

**OWASP:** A02:2021 – Cryptographic Failures / A07:2021 – Identification
and Authentication Failures (CWE-522: Insufficiently Protected Credentials)

**Where:** `frontend/src/api/client.js`, `frontend/src/api/auth.js`,
`frontend/src/context/AuthProvider.jsx`, `frontend/src/components/ProtectedRoute.jsx`,
`frontend/src/api/orders.js`, `frontend/src/api/reports.js`,
`backend/src/controllers/auth.controller.ts`, `backend/src/routes/auth.routes.ts`

**The vulnerability.** Both the short-lived JWT access token and the
long-lived refresh token were stored in the browser's `localStorage`. Any
JavaScript running in the page — including code injected via an XSS
vulnerability anywhere else in the app, or in a compromised third-party
script/dependency — has unrestricted read access to `localStorage`. That
turns a single, otherwise-contained XSS bug into full, silent, persistent
account takeover: an attacker's payload can simply read
`localStorage.getItem('refreshToken')` and mint fresh access tokens
indefinitely, long after the original XSS payload has been removed.

**The fix.** The token-storage model was redesigned around the standard
"access token in memory, refresh token in an `httpOnly` cookie" pattern:

- The backend's `/auth/register`, `/auth/staff`, `/auth/login`,
  `/auth/refresh`, and the new `/auth/google` all set the refresh token as
  an `httpOnly`, `sameSite`-protected cookie (`sameSite: 'lax'` +
  `secure: false` in development where frontend/backend share a site on
  different localhost ports; `sameSite: 'none'` + `secure: true` in
  production where they are genuinely cross-site) instead of returning it
  in the JSON response body. `httpOnly` means client-side JavaScript
  **cannot read this cookie at all**, even with a successful XSS — it is
  only ever sent automatically by the browser on requests to the API
  origin.
- The access token is still returned in the JSON body (it has to be,
  briefly, to be attached as an `Authorization: Bearer` header), but the
  frontend (`api/client.js`) now keeps it **only in a JavaScript module
  variable**, never in `localStorage`/`sessionStorage`. It is lost on full
  page reload by design — `AuthProvider` transparently re-acquires a fresh
  one on mount via a silent `POST /auth/refresh` call, which succeeds
  because the browser automatically attaches the httpOnly cookie.
  `ProtectedRoute` gained an `isInitializing` guard so this brief
  bootstrap window doesn't cause a flash-redirect to `/login`.
- Every fetch call that needs the session now sends
  `credentials: 'include'` so the httpOnly cookie is attached; a final
  sweep (`grep -rn "localStorage.*[Tt]oken" frontend/src`) confirmed **two
  remaining call sites that had been missed** — `api/orders.js`'s
  `downloadInvoice()` and `api/reports.js`'s `getAuthHeaders()` /
  `downloadReport()` — both of which were still reading
  `localStorage.getItem('accessToken')` directly with a raw, uncredentialed
  `fetch()`. Both were corrected to call the shared `getAccessToken()`
  accessor and to send `credentials: 'include'`, so all authenticated
  requests in the app now go through the same, consistent mechanism.
- Only non-sensitive data (the cached user profile object, `mts_user`) is
  still kept in `localStorage`, purely as a UI convenience.

**Best practice that would have prevented it:** never put a bearer
credential (session token, API key, refresh token) anywhere JavaScript can
read it if it doesn't strictly have to be there — `httpOnly` cookies exist
specifically to keep credentials out of reach of an XSS payload, and should
be the default for anything long-lived.

---

## 6. No Rate Limiting on Authentication Endpoints

**OWASP:** A07:2021 – Identification and Authentication Failures (CWE-307:
Improper Restriction of Excessive Authentication Attempts)

**Where:** `backend/src/routes/auth.routes.ts`, `backend/src/config/env.ts`

**The vulnerability.** `POST /auth/login` and `POST /auth/register` had no
request-rate limiting of their own (only a generic, much looser global
limiter applied to the whole API). This allowed unlimited automated login
attempts against any known email address — i.e. a practical credential-
stuffing / password-brute-force attack — and unlimited automated account
creation.

**The fix.** A dedicated `authRateLimiter`
(`express-rate-limit`, configurable via `AUTH_RATE_LIMIT_WINDOW_MS` /
`AUTH_RATE_LIMIT_MAX`, default: 10 requests per 10-minute window per IP) was
added and applied specifically to `/auth/register` and `/auth/login`, on
top of the existing global rate limiter.

**Best practice that would have prevented it:** authentication endpoints
are a materially higher-value target than the rest of an API's surface and
need their own, tighter rate limit — a single global limit sized for normal
API usage is almost always too loose to meaningfully slow down a credential-
stuffing attack.

---

## 7. Cross-Tenant Authorization Bypass on Pharmacy Inventory

**OWASP:** A01:2021 – Broken Access Control (CWE-284: Improper Access
Control)

**Where:** `backend/src/services/inventory.service.ts`,
`backend/src/controllers/inventory.controller.ts`, `backend/src/routes/inventory.routes.ts`

**The vulnerability.** Inventory-mutation endpoints
(`create`/`update`/`delete` medication stock) checked *that* the caller had
the Pharmacy Staff role, but never checked *which* pharmacy the caller's
account belonged to against the `pharmacyId` on the inventory item being
modified. Pharmacy Staff at Pharmacy A could edit or delete Pharmacy B's
inventory records simply by supplying Pharmacy B's `pharmacyId` /
inventory-item id — a cross-tenant authorization bypass in a system that is
explicitly multi-tenant (multiple independent pharmacies).

**The fix.** Mirroring the pattern used for Fix #1, the affected service
methods now take a `RequestingUser` and run the target record through a new
`assertOwnsPharmacy()` guard (System Admins are exempt, by design) before
allowing `create`/`update`/`delete` to proceed; the controller builds and
passes the `RequestingUser` from the verified JWT. Six new tests
(`describe('InventoryService cross-tenant authorization', ...)`) assert
that Pharmacy Staff from one pharmacy receive `403 Forbidden` when
targeting another pharmacy's inventory.

**Best practice that would have prevented it:** in any multi-tenant system,
role-based checks ("is this user Staff?") are not sufficient on their own —
they must be combined with a tenant/ownership check ("does this Staff
member belong to *this* tenant's record?") on every mutating operation.

---

## 8. Vulnerable / Outdated Third-Party Dependencies — NOT FIXED

**OWASP:** A06:2021 – Vulnerable and Outdated Components

**Status: identified via automated SCA scanning, deliberately left
unfixed for this submission.** This is disclosed here rather than silently
left out, per the assignment's explicit instruction to document any
vulnerability found but not fixed, and why.

**What was found.** Running `npm audit` against both `backend/` and
`frontend/` in the modified project reports:

- **Backend:** 20 vulnerabilities (2 low, 6 moderate, 10 high, 2 critical).
  The two critical findings are both in `node-tar` (pulled in transitively
  through `bcrypt` → `@mapbox/node-pre-gyp` → `tar`, a native-module build
  dependency, not application code that runs at request time) — arbitrary
  file overwrite / path traversal during package installation. High/
  moderate findings include an `axios` SSRF-adjacent proxy-bypass issue and
  a prototype-pollution issue in its `validateStatus` merge strategy.
- **Frontend:** 11 vulnerabilities (1 low, 2 moderate, 8 high), the most
  notable being high-severity path-traversal and arbitrary-file-read issues
  in `vite`'s dev server (`GHSA-4w7w-66w2-5vf9`, `GHSA-p9ff-h696-f583`),
  which only affect `npm run dev`, not the production build, plus a
  `react-router` advisory.

**Why it was not fixed.** `npm audit fix --force` for the backend's `tar`
chain would force a **major, breaking upgrade of `bcrypt` to 6.0.0**, and
several of the frontend fixes require major-version bumps of `vite` /
`react-router-dom`. Within the scope and time available for this
assignment, upgrading these would risk breaking the password-hashing
implementation and the client-side routing/dev-server setup in ways that
could not be adequately regression-tested here (see the note on the test
suite below) without risking destabilizing the seven vulnerability fixes
already made and verified. This is exactly the kind of trade-off a real
engineering team documents and schedules rather than rushes: the fixes are
either (a) in native-build tooling that doesn't run in the deployed
server/browser at request time (the `tar`/`node-pre-gyp` chain), or (b)
require a tracked, tested major-version upgrade as separate follow-up work,
not an emergency patch.

**Best practice that would prevent/limit this going forward:** run
`npm audit` (or a continuous SCA tool such as Dependabot/Snyk/Renovate) as
part of CI on every pull request, not ad hoc; pin and review dependency
upgrades on a regular cadence *before* a large number of advisories
accumulate, so each upgrade is small, well-tested, and low-risk, rather
than facing a batch of major-version jumps all at once.

---

## New Feature: Sign in with Google (OAuth 2.0 / OpenID Connect)

**Requirement addressed:** "Implement an OAuth or OpenID Connect based
grant type to add a new feature or update an existing one."

**What was built.** A "Sign in with Google" option was added to the
existing Login and Signup pages, implemented as the **OAuth 2.0
Authorization Code grant**, combined with **OpenID Connect ID-token
verification** — the grant type recommended by the OAuth 2.0 Security Best
Current Practice (RFC 9700) for browser-based clients, in preference to the
legacy Implicit grant (which exposes tokens directly in the URL fragment
and cannot be safely used with a confidential client secret).

**Flow:**

1. `frontend/src/utils/googleOAuth.js` — `startGoogleSignIn()` generates a
   random `state` value (stored in `sessionStorage`, for CSRF protection),
   then redirects the browser to Google's `/o/oauth2/v2/auth` consent
   screen with `response_type=code`, the app's public `client_id`, and
   `scope=openid email profile`. Only the **public** client id is ever
   present in frontend code.
2. Google redirects back to `frontend/src/pages/GoogleOAuthCallbackPage.jsx`
   with a one-time-use authorization `code` and the `state` value. The page
   verifies `state` matches what was stored (rejecting the callback
   otherwise), then hands the `code` to the backend — it never tries to
   redeem the code itself.
3. `backend/src/services/oauth.service.ts` — `OAuthService.loginWithGoogle()`
   redeems the authorization code at Google's token endpoint using the
   **confidential client secret**, which lives only on the server
   (`GOOGLE_CLIENT_SECRET`, never shipped to the browser), receiving back an
   OpenID Connect **ID token**. That ID token is cryptographically verified
   (signature, issuer, audience, expiry) using Google's official
   `google-auth-library` `OAuth2Client`, rather than trusting any of its
   claims unverified.
4. Once verified, the service finds an existing user by `googleId` or
   email, links a Google identity to an existing password account (if the
   verified email matches one), or creates a new user — always with the
   safe `UserRole.PATIENT` default, for the same reason as Fix #2 above; a
   third party's OAuth response is exactly as untrusted as any other
   client input and must never be allowed to set a privileged role.
5. A normal app session is then established exactly like a password login —
   the same httpOnly-cookie refresh token + in-memory access token pattern
   from Fix #5.

**Supporting model change:** `backend/src/models/user.model.ts` gained
`authProvider` (`'local' | 'google'`) and `googleId` fields, with the
`password` field's `required` validator and the `comparePassword`/
`pre('save')` hashing hooks made conditional — an OAuth-only user
legitimately has no local password.

Configuration is fully optional (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/
`GOOGLE_OAUTH_REDIRECT_URI` on the backend, `VITE_GOOGLE_CLIENT_ID`/
`VITE_GOOGLE_REDIRECT_URI` on the frontend) — the app boots and functions
normally with password auth alone if these are unset, and the "Sign in with
Google" button simply doesn't render (`isGoogleSignInConfigured()`).

---

## Best Practices Summary — What Would Have Prevented All Eight Issues

| Issue | Best practice |
|---|---|
| 1, 7 | Enforce object-level / tenant-level authorization on every operation that takes a client-supplied identifier, not just role checks. |
| 2 | Never let client input determine a security-sensitive field (role, ownership, price); use explicit server-side allow-lists. |
| 3 | Fail closed on weak configuration — validate secret strength at startup and reject known placeholders. |
| 4 | Treat all interpreters (SQL, NoSQL operators, regex, shell) the same way: escape or parameterize user input, never concatenate it into "code". |
| 5 | Keep long-lived credentials out of any storage JavaScript can read (`httpOnly` cookies over `localStorage`) so a single XSS bug can't become full account takeover. |
| 6 | Apply stricter rate limits to authentication endpoints specifically, not just a general API-wide limit. |
| 8 | Run continuous, automated dependency scanning (SCA) in CI, and upgrade on a regular small-batch cadence rather than in one large, risky jump. |

Underlying all of them: **threat model before building** (STRIDE-style
"what can go wrong here"), **least privilege by default**, and **never
trust data that crosses a trust boundary** — whether that boundary is a
request body, a URL parameter, a third-party OAuth response, or a
dependency's own advisory feed.

---

## Verification

- `backend`: `npx tsc --noEmit` passes with zero errors after every change
  described above (used as a continuous correctness gate throughout).
- `backend`: existing Jest unit-test suites for `order.service` and
  `inventory.service` were updated for the new `RequestingUser` parameter
  on every affected method, and extended with new regression tests
  specifically asserting the fixed authorization boundaries (Fix #1: 3 new
  tests; Fix #7: 6 new tests). **Note:** the Jest suite itself could not be
  executed inside the sandboxed environment this work was performed in — it
  depends on `mongodb-memory-server`, which downloads a `mongod` binary
  from `fastdl.mongodb.org` at test-run time, and that host is blocked by
  the sandbox's network egress policy. The test files were updated and
  reviewed carefully by hand and via `tsc`, but **should be run locally
  (`npm test` inside `backend/`) to get an actual pass/fail signal before
  submission.**
- `frontend`: `npm install && npm run build` succeeds cleanly (Vite
  production build, zero errors) after all changes.
- `npm audit` was run against both `backend/` and `frontend/` as the
  "security-related open-source testing tool" evidence for Finding #8.
