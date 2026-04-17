import { Global, Module } from '@nestjs/common';

/**
 * Placeholder for cross-cutting helpers that do not belong to any single
 * feature module. Marked @Global so utilities and enums can be imported
 * without re-importing this module everywhere.
 *
 * Kept intentionally empty during Sprint 2 — utilities (reference code,
 * money helpers) are exposed as pure functions rather than injectable
 * providers, which keeps them unit-testable in isolation.
 */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class CommonModule {}
