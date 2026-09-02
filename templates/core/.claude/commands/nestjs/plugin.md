# /nestjs/plugin <Name> <Adapter>

Scaffolds a new port/adapter plugin following the project's pattern.

## Usage

```
/nestjs/plugin Storage S3
/nestjs/plugin Payment Stripe
/nestjs/plugin Cache Redis
```

## What gets created

```
src/plugins/{name}/
├── {name}.port.ts           # abstract class — the contract
├── {name}.module.ts         # @Global() DynamicModule.register()
├── exceptions/
│   ├── {name}-*.exception.ts
│   └── index.ts
└── {adapter}/
    ├── {adapter}.adapter.ts  # extends the port
    ├── {adapter}.config.ts   # wraps ConfigService for env vars
    └── {adapter}.module.ts
```

## Rules

- Port is an **abstract class** (not interface) so NestJS DI can use it as a runtime token.
- `{Name}Module.register()` is a static `DynamicModule` method — reads `process.env` directly (dotenv loaded before DI).
- Re-export the adapter module from `{Name}Module.register()`:
  ```typescript
  return { module: {Name}Module, imports: [adapterModule], exports: [adapterModule] };
  ```
  Never export the port token directly — NestJS 11 requires re-exporting the module.
- Add env vars to `.env.example` and `src/config/env.validation.ts`.
- All errors use exception classes — no inline throws.
- Register `{Name}Module.register()` in `src/app.module.ts`.
