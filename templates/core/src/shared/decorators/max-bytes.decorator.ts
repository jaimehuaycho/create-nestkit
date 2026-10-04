import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';
import { byteLength } from '../utils/bytes.util.js';

/**
 * Like `@MaxLength`, but counts UTF-8 BYTES instead of characters. Use it on anything hashed with bcrypt, which
 * ignores everything past 72 bytes: a longer password would be silently truncated, so two different long passwords
 * with the same first 72 bytes would be treated as equal.
 */
export function MaxBytes(max: number, validationOptions?: ValidationOptions): PropertyDecorator {
    return ValidateBy(
        {
            name: 'maxBytes',
            constraints: [max],
            validator: {
                validate: (value: unknown) => typeof value === 'string' && byteLength(value) <= max,
                defaultMessage: buildMessage(
                    (eachPrefix) => `${eachPrefix}$property must not exceed $constraint1 bytes`,
                    validationOptions,
                ),
            },
        },
        validationOptions,
    );
}
