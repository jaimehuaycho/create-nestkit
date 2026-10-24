import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TRANSPORTS } from '../transports/index.js';

describe('transport registry', () => {
    it('registers the built-in transports', () => {
        expect(Object.keys(TRANSPORTS)).toEqual(['log', 'file', 'smtp', 'resend', 'postmark', 'sendgrid', 'ses']);
    });

    // Adding a transport (or a variable) without telling .env.example and env.validation.ts fails here.
    const envExample    = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
    const envValidation = readFileSync(join(process.cwd(), 'src', 'config', 'env.validation.ts'), 'utf8');

    for (const [name, definition] of Object.entries(TRANSPORTS)) {
        it(`${name}: every variable is in .env.example and env.validation.ts`, () => {
            expect(envExample, `no section for ${name} in .env.example`).toContain(`--- MAIL_TRANSPORT=${name}`);
            for (const variable of definition.env) {
                expect(envExample, `${variable.name} missing in .env.example`).toMatch(new RegExp(`^#? ?${variable.name}=`, 'm'));
                expect(envValidation, `${variable.name} missing in env.validation.ts`).toContain(`${variable.name}:`);
            }
        });
    }
});
