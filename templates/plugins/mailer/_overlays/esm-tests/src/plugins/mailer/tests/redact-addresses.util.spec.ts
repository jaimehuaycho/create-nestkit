import { describe, expect, it } from 'vitest';
import { redactAddresses } from '../utils/index.js';

describe('redactAddresses', () => {
    it('replaces an address, keeping the reason', () => {
        expect(redactAddresses('Invalid mail: to has an invalid domain: "x@bad"')).toBe('Invalid mail: to has an invalid domain: "<address>"');
    });

    it('absorbs the angle brackets a server puts around it', () => {
        expect(redactAddresses('550 5.1.1 <bob@example.com>: Recipient address rejected')).toBe('550 5.1.1 <address>: Recipient address rejected');
    });

    it('replaces every address, with a display name or not', () => {
        expect(redactAddresses('From "Ann" <ann@a.test>, to bob@b.test and c@c.test')).toBe('From "Ann" <address>, to <address> and <address>');
    });

    it('leaves text without addresses alone', () => {
        expect(redactAddresses('Connection refused (ECONNREFUSED)')).toBe('Connection refused (ECONNREFUSED)');
    });
});
