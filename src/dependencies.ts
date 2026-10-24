// Version ranges for every non-@nestjs/* package the generator installs (the @nestjs/* ones live in nest-version.ts).
//
// WHY THIS EXISTS: a bare `npm install typeorm` installs whatever is latest on the day the project is generated, so a new
// MAJOR release changes what users get without any change in this repo (TypeORM 1.x dropped the `sqlite` driver exactly
// that way). Each range pins the MAJOR the templates were written and verified against: patches and minors still flow in,
// a new major never does until we adopt it on purpose.
//
// For 0.x packages the caret pins the MINOR (`^0.45.1` means < 0.46.0), because in 0.x a minor can break.
//
// TO ADOPT A NEW MAJOR: read the package's changelog and docs, update the templates that use it, generate a real project
// and run it (see .claude/rules/testing.md), then change the range here. `dependencies.test.ts` fails if anything the
// generator installs has no range, so nothing can slip in unpinned.
//
// Verified 2026-10-04 against: see .claude/context/dependencies.md.
export const DEPENDENCY_RANGES: Record<string, string> = {
    // core
    joi:                   '^18',
    dotenv:                '^18',
    'class-validator':     '^0.15',
    'class-transformer':   '^0.5',
    '@nestjs/throttler':   '^6',   // not coupled to the Nest major: it has its own version line

    // database
    typeorm:               '^1',
    tsx:                   '^4',
    pg:                    '^8',
    mysql2:                '^3',
    mssql:                 '^12',

    // auth
    passport:              '^0.7',
    otpauth:               '^9',
    'passport-jwt':        '^4',
    '@types/passport-jwt': '^4',
    bcrypt:                '^6',
    '@types/bcrypt':       '^6',
    argon2:                '^0.45',

    // mailer
    '@nestjs-modules/mailer': '^3',
    nodemailer:            '^10',
    handlebars:            '^4',

    // pdf, socket, observability
    puppeteer:             '^25',
    'socket.io':           '^4',
    '@nestjs/observe':     '^0.3',
};
