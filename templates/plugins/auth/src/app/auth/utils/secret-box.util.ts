import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM: confidentiality AND integrity (a tampered value fails to decrypt instead of returning garbage).
// Stored form: "v1.<iv>.<auth tag>.<ciphertext>", each part base64url. The version prefix lets the format change later.

export function encryptSecret(plain: string, key: Buffer): string {
    const iv     = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data   = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(boxed: string, key: Buffer): string {
    const [version, iv, tag, data] = boxed.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported secret format.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
