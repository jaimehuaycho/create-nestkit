// dotenv must load first — TypeORM CLI runs without NestJS, so there is no DI or AppConfig.
import 'dotenv/config';

import { DataSource } from 'typeorm';

// Used exclusively by the TypeORM CLI (migration:generate, migration:run, migration:revert).
// Keep connection settings in sync with DatabaseConfig.
export const AppDataSource = new DataSource({
    type:     process.env.DB_TYPE as any,
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    entities:   ['src/**/*.entity.ts'],
    migrations: ['src/database/migrations/*.ts'],

    synchronize: false, // never let TypeORM alter the schema automatically
    logging:     false,
});
