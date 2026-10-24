import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { errorBody } from '../../../shared/utils/swagger/index.js';

export const VERIFIED_EMAIL_KEY = 'authorization:verifiedEmail';

/**
 * Requires the signed-in user to have confirmed their email address (403 EMAIL_NOT_VERIFIED otherwise). Reads the standard
 * `email_verified` claim of the access token, so it costs no database query; a user who just verified gets it in the token at the
 * next refresh (or login).
 */
export const VerifiedEmail = () =>
    applyDecorators(
        SetMetadata(VERIFIED_EMAIL_KEY, true),
        ApiForbiddenResponse({ description: 'Requires a verified email address.', schema: { example: errorBody(403, 'EMAIL_NOT_VERIFIED', 'You must verify your email address to do this.') } }),
    );
