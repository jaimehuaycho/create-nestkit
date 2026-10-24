import { Transform } from 'class-transformer';

/** Removes whitespace from a code typed by a person ("123 456" -> "123456") before it is validated. Needs ValidationPipe({ transform: true }). */
export const StripSpaces = () =>
    Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value));
