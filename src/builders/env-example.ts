import * as fs   from 'fs';
import * as path from 'path';

const BASE = `# Server
NODE_ENV=development
PORT=3000
API_PREFIX=api
DOMAIN_FRONTEND=*
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
    sqlite: `
# Database (SQLite)
DB_TYPE=sqlite
DB_NAME=./db.sqlite
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

    return fragments.join('');
}
