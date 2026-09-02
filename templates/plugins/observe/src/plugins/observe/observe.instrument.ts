import { createObserveModule } from '@nestjs/observe';

// createObserveModule() must be called exactly once at module-load time — it's the
// only place NestObserveModule and ObserveInstrument come from. Renamed on export so
// it doesn't collide with our own ObservabilityModule (see observe.module.ts), which
// wraps it behind the same ConfigService-driven forRootAsync() pattern every other
// plugin here uses (database, mailer) instead of reading process.env directly.
export const { ObserveModule: NestObserveModule, ObserveInstrument } = createObserveModule();
