// dotenv must load first — this script runs outside NestJS.
import 'dotenv/config';

import { AppDataSource } from '../config/data-source.js';
import { User } from '../../modules/users/entities/user.entity.js';
import { Role } from '../../modules/roles/entities/role.entity.js';
import { hashPassword } from '../../shared/utils/crypto.util.js';

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

// Insertion order fixes the auto-generated ids to 1/2/3, matching the role
// hierarchy documented in CLAUDE.md (root=1, admin=2, user=3).
const ROLE_NAMES = ['root', 'admin', 'user'] as const;

/**
 * Inserts the root/admin/user roles if they don't already exist.
 * Idempotent — safe to run multiple times.
 */
async function seedRoles(): Promise<void> {
    const repo = AppDataSource.getRepository(Role);

    for (const name of ROLE_NAMES) {
        const existing = await repo.findOne({ where: { name } });
        if (existing) continue;

        const role = repo.create({ name });
        await repo.save(role);
        console.log(`  ${GREEN}✔  Role created${RESET} → ${name}`);
    }
}

/**
 * Inserts the root user if it does not already exist.
 * Idempotent — safe to run multiple times.
 * Uses the TypeORM repository API so it works with any supported database driver.
 */
async function seedRootUser(): Promise<void> {
    const email    = process.env.SEED_ROOT_EMAIL    ?? 'root@app.com';
    const password = process.env.SEED_ROOT_PASSWORD ?? 'Root1234!';

    const repo = AppDataSource.getRepository(User);

    const existing = await repo.findOne({ where: { email } });

    if (existing) {
        console.log(`  ${YELLOW}⚠  Root user already exists${RESET} (${email}) — skipping.`);
        return;
    }

    const hashed = await hashPassword(password);

    // roleId = 1 is the root role created by the initial migration.
    const user = repo.create({ email, password: hashed, roleId: 1 });
    await repo.save(user);

    console.log(`  ${GREEN}✔  Root user created${RESET} → ${BOLD}${email}${RESET}`);
    console.log(`  ${YELLOW}⚠  Change the root password in production.${RESET}`);
}

async function seed(): Promise<void> {
    console.log(`\n${CYAN}${BOLD}▶  Running seed...${RESET}\n`);

    await AppDataSource.initialize();
    console.log(`  ${GREEN}✔  Database connection established${RESET}`);

    try {
        await seedRoles();
        await seedRootUser();
        // Add more seeders here in dependency order.

        console.log(`\n${GREEN}${BOLD}✔  Seed completed.${RESET}\n`);
    } catch (error) {
        console.error(`\n${RED}${BOLD}✘  Seed failed:${RESET}`, error);
        process.exit(1);
    } finally {
        await AppDataSource.destroy();
    }
}

seed();
