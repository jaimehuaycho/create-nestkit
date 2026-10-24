// dotenv must load first — this script runs outside NestJS.
import 'dotenv/config';

import { randomBytes } from 'node:crypto';
import { AppDataSource } from '../config/data-source.js';
import { User } from '../../modules/users/entities/user.entity.js';
import { Role } from '../../modules/roles/entities/role.entity.js';
import { BUILT_IN_ROLES } from '../../modules/roles/roles.constants.js';
import { RoleEnum } from '../../shared/enums/index.js';
import { hashPassword } from '../../shared/security/password.util.js';

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

// Roles are identified by NAME, not by a number, and there is no hierarchy: what each role may do is listed explicitly in the
// @Roles(...) decorators on the routes. Add your own roles to RoleEnum, seed them here and list them in the routes that allow them.
const ROLE_NAMES = BUILT_IN_ROLES;
const ROLE_DESCRIPTIONS: Record<RoleEnum, string> = {
    [RoleEnum.ROOT]:  'Full control, including roles',
    [RoleEnum.ADMIN]: 'Manages users',
    [RoleEnum.USER]:  'Regular account',
};

/**
 * Inserts the root/admin/user roles if they don't already exist.
 * Idempotent — safe to run multiple times.
 */
async function seedRoles(): Promise<void> {
    const repo = AppDataSource.getRepository(Role);

    for (const name of ROLE_NAMES) {
        const existing = await repo.findOne({ where: { name } });
        if (existing) continue;

        const role = repo.create({ name, description: ROLE_DESCRIPTIONS[name] });
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
    // No default password: a known one is a back door. Without SEED_ROOT_PASSWORD a random one is generated and printed ONCE.
    const provided = process.env.SEED_ROOT_PASSWORD?.trim();
    const password = provided || randomBytes(18).toString('base64url');

    const repo = AppDataSource.getRepository(User);

    const existing = await repo.findOne({ where: { email } });

    if (existing) {
        console.log(`  ${YELLOW}⚠  Root user already exists${RESET} (${email}) — skipping.`);
        return;
    }

    const hashed = await hashPassword(password);

    // Roles are identified by name: the root role is created by seedRoles() above.
    const user = repo.create({ email, password: hashed, roleName: RoleEnum.ROOT, emailVerifiedAt: new Date() });
    await repo.save(user);

    console.log(`  ${GREEN}✔  Root user created${RESET} → ${BOLD}${email}${RESET}`);
    if (!provided) console.log(`  ${YELLOW}⚠  Generated password (shown only now): ${BOLD}${password}${RESET}`);
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
