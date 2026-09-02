import { createObserveModule } from '@nestjs/observe';

// Distributed tracing, auto-correlated logs, request/job metrics, and error telemetry —
// sign up at https://observe.nestjs.com to get OBSERVE_APP_KEY / OBSERVE_APP_SECRET.
// Without valid credentials, telemetry is silently dropped — the app still boots fine.
export const { ObserveModule, ObserveInstrument } = createObserveModule();
