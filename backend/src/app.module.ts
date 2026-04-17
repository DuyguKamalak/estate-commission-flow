import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { CommonModule } from './common/common.module';
import { HealthController } from './health/health.controller';

/**
 * Root application module.
 *
 * Sprint 2 scope — wires configuration, global validation, global error
 * filtering (registered in main.ts) and a health endpoint. Persistence
 * (MongooseModule) is intentionally deferred to Sprint 3, where it will
 * be introduced alongside the first domain schema so the app can still
 * boot locally without a MongoDB connection during scaffolding.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
    CommonModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
