import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { dataSourceOptions } from '../data-source';
import { DataSource } from 'typeorm';
import { hashPassword } from '../../common/utils/password.util';

dotenv.config();

/**
 * One-off CLI script to create (or promote) the first ADMIN account,
 * fully activated - no email verification or approval step needed, since
 * there is no admin yet to approve it. Run with: npm run seed:admin
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD from the environment so the password
 * never has to appear in shell history.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=... npm run seed:admin');
    process.exit(1);
  }

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    const adminRole = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM roles WHERE name = 'ADMIN'`,
    );
    if (adminRole.length === 0) {
      throw new Error('ADMIN role not found - run "npm run migration:run" first');
    }

    const existing = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM users WHERE email = $1`,
      [email],
    );

    const passwordHash = await hashPassword(password);

    if (existing.length > 0) {
      await dataSource.query(
        `UPDATE users
         SET "roleId" = $1, status = 'ACTIVE', "passwordHash" = $2, "emailVerifiedAt" = COALESCE("emailVerifiedAt", now()), "approvedAt" = COALESCE("approvedAt", now())
         WHERE id = $3`,
        [adminRole[0].id, passwordHash, existing[0].id],
      );
      console.log(`Existing user ${email} promoted to ADMIN and activated.`);
    } else {
      await dataSource.query(
        `INSERT INTO users (email, "passwordHash", status, "roleId", "emailVerifiedAt", "approvedAt")
         VALUES ($1, $2, 'ACTIVE', $3, now(), now())`,
        [email, passwordHash, adminRole[0].id],
      );
      console.log(`Admin user ${email} created and activated.`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Failed to seed admin user:', error);
  process.exit(1);
});
