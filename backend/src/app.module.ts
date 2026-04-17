import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { CommonModule } from './common/common.module';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AgentsModule } from './modules/agents/agents.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { ReportsModule } from './modules/reports/reports.module';

/**
 * Root application module.
 *
 * Sprint 3 scope — persistence is now wired up (DatabaseModule) and the
 * three feature modules (Agents, Transactions, Commissions) are registered
 * so their schemas are known to Mongoose at boot time. Services and
 * controllers arrive in Sprint 5.
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
    DatabaseModule,
    AgentsModule,
    TransactionsModule,
    CommissionsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
