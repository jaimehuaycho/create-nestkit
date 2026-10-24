import * as fs   from 'fs';
import * as path from 'path';

const BASE = `# Server
NODE_ENV=development
PORT=3000
API_PREFIX=api

# CORS — a single origin or a comma-separated list. '*' (any origin) is accepted in development only: production refuses to start with it.
CORS_ORIGINS=*

# Reverse proxy / load balancer in front of the app: how many proxies sit between the client and the API (1, 2...), or leave empty.
# Needed for correct client IPs (rate limiting counts per IP). Do not use true: a client could forge X-Forwarded-For.
TRUST_PROXY=

# Rate limiting, per client IP. Every route: THROTTLE_LIMIT requests per THROTTLE_TTL window.
# Routes marked @StrictRateLimit() (sign-in, register, password reset) also get THROTTLE_STRICT_LIMIT per THROTTLE_STRICT_TTL.
THROTTLE_TTL=1m
THROTTLE_LIMIT=100
THROTTLE_STRICT_TTL=1m
THROTTLE_STRICT_LIMIT=10
`;

const DB_ENV: Record<string, string> = {
    postgres: `
# Database (PostgreSQL)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=your_database
DB_LOGS=false

# Seed
SEED_ROOT_EMAIL=root@app.com
SEED_ROOT_PASSWORD=Root1234!
`,
    mysql: `
# Database (MySQL)
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=mysql
DB_PASSWORD=your_password
DB_NAME=your_database
DB_LOGS=false

# Seed
SEED_ROOT_EMAIL=root@app.com
SEED_ROOT_PASSWORD=Root1234!
`,
    mariadb: `
# Database (MariaDB)
DB_TYPE=mariadb
DB_HOST=localhost
DB_PORT=3306
DB_USER=mariadb
DB_PASSWORD=your_password
DB_NAME=your_database
DB_LOGS=false

# Seed
SEED_ROOT_EMAIL=root@app.com
SEED_ROOT_PASSWORD=Root1234!
`,
    mssql: `
# Database (SQL Server)
DB_TYPE=mssql
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_password
DB_NAME=your_database
DB_LOGS=false

# Seed
SEED_ROOT_EMAIL=root@app.com
SEED_ROOT_PASSWORD=Root1234!
`,
};

export function buildEnvExample(
    pluginIds:    string[],
    dbDriver:     string,
    templatesDir: string,
): string {
    const fragments: string[] = [BASE];

    for (const id of pluginIds) {
        if (id === 'database') {
            // Use driver-specific env block instead of the generic fragment
            fragments.push(DB_ENV[dbDriver] ?? DB_ENV.postgres);
            continue;
        }
        const fragmentPath = path.join(templatesDir, 'plugins', id, '_env.example.fragment');
        if (fs.existsSync(fragmentPath)) {
            fragments.push(fs.readFileSync(fragmentPath, 'utf-8'));
        }
    }

    // Each fragment is one section. Normalize them instead of trusting each file's own leading/trailing blank
    // lines (some had none, so a section started right under the previous one), and separate sections with
    // exactly one blank line so the file reads as clearly delimited blocks.
    return fragments.map(fragment => fragment.trim()).join('\n\n') + '\n';
}
