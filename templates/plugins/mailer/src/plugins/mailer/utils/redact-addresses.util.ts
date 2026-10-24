// Mail errors can carry the recipient's address ("to has an invalid domain: x@bad", "550 <bob@example.com>: user unknown"). The text is what an
// operator needs to fix the problem, the address is personal data that should not reach the logs: keep one, drop the other.
// The optional angle brackets of "<bob@example.com>" go too, so the result reads "<address>".
const ADDRESS = /<?[^\s<>"',;()]+@[^\s<>"',;()]+>?/g;

export const redactAddresses = (text: string): string => text.replace(ADDRESS, '<address>');
