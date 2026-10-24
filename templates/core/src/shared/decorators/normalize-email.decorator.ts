import { Transform } from 'class-transformer';

/**
 * Trims and lower-cases an e-mail before validation, so "User@Mail.com " and "user@mail.com" are the same account. Without it the
 * unique index (case-sensitive) lets one mailbox own several accounts. Requires ValidationPipe({ transform: true }).
 */
export const NormalizeEmail = () =>
    Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
