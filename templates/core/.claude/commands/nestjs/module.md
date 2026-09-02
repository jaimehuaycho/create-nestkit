# /nestjs/module <Name>

Scaffolds a complete CRUD module following the project's methodology.

## Usage

```
/nestjs/module Product
/nestjs/module OrderItem
```

`<Name>` is the singular PascalCase entity name. The module, service, and controller will be pluralized automatically.

## What gets created

```
src/modules/{name}s/
├── controllers/{name}s.controller.ts
├── services/{name}s.service.ts
├── dto/
│   ├── {name}.dto.ts
│   ├── create-{name}.dto.ts
│   ├── update-{name}.dto.ts
│   ├── find-all-{name}s-params.dto.ts
│   └── find-all-{name}s-response.dto.ts
├── entities/{name}.entity.ts
├── exceptions/
│   ├── {name}-not-found.exception.ts
│   ├── {name}-already-exists.exception.ts
│   └── index.ts
└── {name}s.module.ts
```

## Generation rules

### Entity
- Extends `BaseEntitySoftDelete`
- PK: `@PrimaryGeneratedColumn({ name: '{name}_id' })` → TypeScript property `id`
- All columns have explicit `name:` in DB snake_case
- Ask the user for columns before generating if not provided

### Output DTO
- Use `@DtoField()` for scalars, `@DtoRelation(() => RelatedDto)` for relations
- Add `@ApiProperty({ example: ... })` on every field

### Service
- Implement the full generic pattern from CLAUDE.md:
  `findAll<T>`, `findOne<T>`, `findOneById<T>`, `create<T>`, `update<T>`, `remove`
- `existsBy` for existence checks in create/update
- `repo.create()` + explicit field assignment in create
- `new DtoRepository(repo).findOne(...)` for transaction-safe return
- `hardDelete` option via `MutationOptions`

### Controller
- Always `async` + `return await` on every method
- JSDoc error dictionary at class level
- `@ApiOperation` with summary + description on every endpoint
- Variadic error decorators: `@ApiNotFound(err1)`, `@ApiConflict(err1)`, `@ApiUnauthorized(err1)`
- Use `@AdminUp()` / `@RootOnly()` / `@UserUp()` — never raw `@Roles(n)`

### Exceptions
- `XNotFoundException extends NotFoundException` → `X_NOT_FOUND`
- `XAlreadyExistsException extends ConflictException` → `X_ALREADY_EXISTS`

### Module
```typescript
@Module({
    imports:     [TypeOrmModule.forFeature([Entity])],
    controllers: [EntityController],
    providers:   [EntityService],
    exports:     [EntityService],
})
```

## After generation

Register the new module in `src/app.module.ts` and run `npm run build` to verify.
