import { OAuth2Client } from 'google-auth-library';
import { User, IUser, UserRole } from '../models/user.model';
import { ApiError } from '../utils/api-error';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * New feature: "Sign in with Google" — OAuth 2.0 / OpenID Connect
 * Authorization Code grant (see SECURITY.md "New Feature").
 *
 * Flow:
 *   1. Frontend redirects the browser to Google's consent screen
 *      (constructed client-side from VITE_GOOGLE_CLIENT_ID — a public value,
 *      safe to expose).
 *   2. Google redirects back to the frontend's callback route with a
 *      short-lived, single-use `code`.
 *   3. The frontend POSTs that `code` to our backend
 *      (POST /api/auth/google), never touching the client *secret*.
 *   4. THIS service exchanges the code for tokens directly with Google
 *      (server-to-server, using GOOGLE_CLIENT_SECRET — which never leaves
 *      the backend), verifies the returned ID token's signature and
 *      claims, and finds-or-creates a local user record.
 *   5. The controller then issues our own access/refresh token pair exactly
 *      as it would for a password login, so the rest of the app (RBAC,
 *      order ownership checks, etc.) doesn't need to know or care whether
 *      the session originated from a password or from Google.
 *
 * This is the Authorization Code grant specifically (rather than the
 * implicit/id_token-only flow) because the code-for-token exchange happens
 * server-side with a confidential client secret, which is the flow OAuth
 * 2.0 recommends for a traditional client/server web app like this one.
 */
export class OAuthService {
  private static getClient(redirectUri: string): OAuth2Client {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw ApiError.badRequest(
        'Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)'
      );
    }
    return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  }

  /**
   * Exchanges an OAuth authorization `code` for Google tokens, verifies the
   * ID token (OpenID Connect), and returns the matching local user —
   * creating one on first sign-in.
   */
  static async loginWithGoogle(
    code: string,
    redirectUri: string
  ): Promise<{ user: IUser; isNewUser: boolean }> {
    const client = this.getClient(redirectUri);

    // Step 1: exchange the authorization code for tokens. This call goes
    // server-to-server to Google's token endpoint and includes the client
    // secret — it can only succeed for a `code` that was actually issued to
    // this application for this exact redirectUri.
    let tokens;
    try {
      ({ tokens } = await client.getToken(code));
    } catch (error) {
      logger.error('Google OAuth code exchange failed:', error);
      throw ApiError.unauthorized('Invalid or expired Google authorization code');
    }

    if (!tokens.id_token) {
      throw ApiError.unauthorized('Google did not return an ID token');
    }

    // Step 2: verify the ID token's signature (against Google's published
    // public keys) and standard OIDC claims (issuer, audience, expiry).
    // This is what actually proves the user's identity — never trust
    // unverified claims from a JWT.
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      throw ApiError.unauthorized('Google ID token did not contain the expected claims');
    }

    if (!payload.email_verified) {
      throw ApiError.forbidden('Your Google email address is not verified');
    }

    const email = payload.email.toLowerCase();

    // Step 3: find-or-create the local user, keyed primarily by Google's
    // stable `sub` claim, falling back to email so an existing
    // password-based account can be linked to Google on first Google login.
    let user = await User.findOne({ googleId: payload.sub }).select('+googleId');
    let isNewUser = false;

    if (!user) {
      user = await User.findOne({ email });

      if (user) {
        // Link the existing password account to this Google identity.
        user.googleId = payload.sub;
        if (payload.email_verified) user.isEmailVerified = true;
        await user.save();
      } else {
        user = await User.create({
          name: payload.name || email.split('@')[0],
          email,
          authProvider: 'google',
          googleId: payload.sub,
          role: UserRole.PATIENT, // SECURITY.md #2: same rule as password registration — Google sign-in can only ever create a Patient account.
          isEmailVerified: true,
          profileImage: payload.picture,
        });
        isNewUser = true;
      }
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account has been deactivated. Contact support.');
    }

    user.lastLogin = new Date();
    await user.save();

    return { user, isNewUser };
  }
}
