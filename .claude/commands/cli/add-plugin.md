# cli/add-plugin

Scaffold a new plugin for create-nestkit.

**Usage:** `/cli/add-plugin <plugin-name>`

Example: `/cli/add-plugin storage`

---

Generate the full plugin structure for **$ARGUMENTS** following the conventions in CLAUDE.md.

## Files to generate

### 1. `templates/plugins/{name}/_manifest.json`

```json
{
  "id": "{name}",
  "requires": [],
  "appModule": {
    "imports": [],
    "modules": []
  },
  "envVars": [],
  "dependencies": { "prod": [], "dev": [] },
  "scripts": {}
}
```

Fill in realistic values based on what this plugin likely needs. Ask if unclear.

### 2. `templates/plugins/{name}/_env.fragment`

Env vars for `.env` (with example values).

### 3. `templates/plugins/{name}/_env.example.fragment`

Same vars but with placeholder values (no real secrets).

### 4. `templates/plugins/{name}/src/plugins/{name}/`

Full port/adapter structure:
- `{name}.port.ts` — abstract class with method signatures
- `{name}.module.ts` — `@Global()` DynamicModule with `register()`
- `{impl}/{impl}.adapter.ts` — default adapter implementation
- `{impl}/{impl}.config.ts` — config service wrapping ConfigService
- `{impl}/{impl}.module.ts` — adapter module

### 5. Update `src/index.ts`

Add the plugin to the multiselect options list.

---

After generating, remind to:
1. Add plugin to `resolvePlugins` if it has transitive deps
2. If it needs dynamic file changes beyond app.module → create or update a builder in `src/builders/`
3. Test by running the CLI and selecting the new plugin
