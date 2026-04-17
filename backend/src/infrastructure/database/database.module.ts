import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { RootConfig } from '../../config/configuration';

/**
 * Centralised MongoDB connection module.
 *
 * - Reads the URI from `ConfigService` so we honour the single source of
 *   truth for configuration (no `process.env` access scattered around).
 * - `connectionFactory` logs a one-shot success / error message at startup,
 *   which is invaluable when diagnosing Atlas IP-allowlist or credential
 *   issues on Render.
 * - `autoIndex` is enabled in non-production environments (so our
 *   uniqueness constraints are enforced during local dev and tests) and
 *   disabled in production (where indexes should be built deliberately via
 *   a migration step).
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<RootConfig, true>) => {
        const uri = config.get('database', { infer: true }).uri;
        const nodeEnv = config.get('app', { infer: true }).nodeEnv;
        const logger = new Logger('Mongoose');

        return {
          uri,
          autoIndex: nodeEnv !== 'production',
          serverSelectionTimeoutMS: 10_000,
          connectionFactory: (connection: {
            on: (
              event: string,
              listener: (err?: Error) => void,
            ) => unknown;
          }) => {
            connection.on('connected', () => {
              logger.log('MongoDB connection established');
            });
            connection.on('disconnected', () => {
              logger.warn('MongoDB connection lost');
            });
            connection.on('error', (err?: Error) => {
              logger.error(
                `MongoDB connection error: ${err?.message ?? 'unknown'}`,
              );
            });
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
