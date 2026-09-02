# /nestjs/exception <Module> <Type>

Adds a new exception class to an existing module.

## Usage

```
/nestjs/exception Product NotFound
/nestjs/exception Order AlreadyExists
/nestjs/exception User Suspended
```

## Generated file

`src/modules/{module}s/exceptions/{module}-{type}.exception.ts`

## Template

```typescript
import { <HttpException> } from '@nestjs/common';

export class <Module><Type>Exception extends <HttpException> {
    constructor() {
        super({ message: '<Human readable message ending with period.>', error: '<MODULE_TYPE>' });
    }
}
```

## HTTP class mapping

| Type name     | Extends                    | Status |
|---------------|----------------------------|--------|
| NotFound      | NotFoundException          | 404    |
| AlreadyExists | ConflictException          | 409    |
| Unauthorized  | UnauthorizedException      | 401    |
| Forbidden     | ForbiddenException         | 403    |
| Invalid       | BadRequestException        | 400    |
| Unavailable   | ServiceUnavailableException| 503    |
| Custom        | Ask user which HTTP status |        |

## After generation

Export the new exception from `exceptions/index.ts` and add its code to the controller's error dictionary JSDoc.
