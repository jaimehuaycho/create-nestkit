import { Injectable } from '@nestjs/common';
import type { Mailable } from '@nestjs/mail';

// EXAMPLE of a mail class: it turns data into a subject and a body (here the template templates/welcome.html and .txt).
// Keep your own next to the feature that sends them (src/modules/users/mails/...); delete this one.
//   this.mails.dispatch(WelcomeMail, { to: user.email, data: { name: user.name } });   // MailDispatcher: in the background
@Injectable()
export class WelcomeMail implements Mailable<{ name: string }> {
    render({ name }: { name: string }) {
        return { subject: `Welcome, ${name}`, template: 'welcome', context: { name } };
    }
}
