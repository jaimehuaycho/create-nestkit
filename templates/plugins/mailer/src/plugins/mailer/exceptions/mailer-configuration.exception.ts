import { InternalServerErrorException } from '@nestjs/common';

// Thrown while the application starts, so a bad mail setup stops the boot instead of failing on the first e-mail.
export class MailerConfigurationException extends InternalServerErrorException {
    constructor(reason: string) {
        super({ message: `The mailer is not configured correctly: ${reason}`, error: 'MAILER_NOT_CONFIGURED' });
    }
}
