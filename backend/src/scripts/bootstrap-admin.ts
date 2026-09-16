/**
 * One-time bootstrap script for creating the FIRST System Admin account.
 *
 * Why this exists (see SECURITY.md #2 — Privilege Escalation via Mass
 * Assignment): POST /auth/register can no longer create anything but a
 * Patient account, and POST /auth/staff (which can create System Admins)
 * itself requires an existing System Admin to call it. That's the correct
 * fix, but it leaves a bootstrap problem — how does the very first admin
 * get created on a fresh database?
 *
 * This script is the answer: it is run directly against the database by a
 * trusted operator (not exposed over HTTP), reads the admin's credentials
 * from environment variables (never hardcoded), and refuses to run if a
 * System Admin already exists.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='Str0ng!Pass' ADMIN_NAME="Ops Admin" \
 *     npm run bootstrap:admin
 */
import { connectDatabase } from '../config/database';
import { User, UserRole } from '../models/user.model';
import { logger } from '../utils/logger';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'System Administrator';

  if (!email || !password) {
    logger.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }

  await connectDatabase();

  const existingAdmin = await User.findOne({ role: UserRole.SYSTEM_ADMIN });
  if (existingAdmin) {
    logger.error(
      `A System Admin account already exists (${existingAdmin.email}). ` +
        'Refusing to bootstrap another one — use POST /auth/staff instead.'
    );
    process.exit(1);
  }

  const existingByEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingByEmail) {
    logger.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const admin = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: UserRole.SYSTEM_ADMIN,
    isEmailVerified: true,
  });

  logger.info(`Bootstrap System Admin created: ${admin.email} (${admin._id})`);
  process.exit(0);
}

main().catch((error) => {
  logger.error('Failed to bootstrap admin account:', error);
  process.exit(1);
});
