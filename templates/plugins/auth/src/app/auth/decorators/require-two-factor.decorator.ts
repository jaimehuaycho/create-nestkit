import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { errorBody } from '../../../shared/utils/swagger/index.js';

export const REQUIRE_TWO_FACTOR_KEY = 'authorization:twoFactor';

/**
 * Requires the session to have been opened with a second factor (403 TWO_FACTOR_REQUIRED otherwise). Reads the standard `amr` claim of
 * the access token. A user who never turned 2FA on cannot use these routes: use it on sensitive operations, or on a whole controller.
 */
export const RequireTwoFactor = () =>
    applyDecorators(
        SetMetadata(REQUIRE_TWO_FACTOR_KEY, true),
        ApiForbiddenResponse({ description: 'Requires a session opened with two-factor authentication.', schema: { example: errorBody(403, 'TWO_FACTOR_REQUIRED', 'This action requires two-factor authentication: sign in with a code from your authenticator app.') } }),
    );
