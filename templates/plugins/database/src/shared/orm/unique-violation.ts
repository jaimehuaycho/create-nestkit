import { QueryFailedError } from 'typeorm';

/**
 * True when a write failed because it broke a UNIQUE constraint (Postgres 23505, MySQL/MariaDB 1062, SQL Server 2627/2601).
 * The "does it exist?" check before an insert cannot stop two simultaneous requests: the constraint is the real guard, and this
 * lets the service answer 409 instead of a 500.
 */
export function isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driver = (error as QueryFailedError & { driverError?: { code?: string | number; errno?: number; number?: number } }).driverError;
    return driver?.code === '23505' || driver?.code === 'ER_DUP_ENTRY' || driver?.errno === 1062 || driver?.number === 2627 || driver?.number === 2601;
}
