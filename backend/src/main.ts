import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api';
  const frontendUrl = config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
  const port = config.get<number>('app.port') ?? 3001;
  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  /*
   * OpenAPI / Swagger.
   *
   * Mounted at `/${apiPrefix}/docs` so reviewers and integrators can
   * explore the full surface area interactively: try requests, inspect
   * error-code enums, and copy typed models. The spec JSON is also
   * exposed at `/${apiPrefix}/docs-json` so it can be piped into
   * codegen tools or imported into Postman.
   *
   * We hide the generic `HealthController` from the main ops tags but
   * keep it documented under its own "Health" tag so uptime checks
   * can still find it in the spec.
   */
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Estate Commission Flow API')
    .setDescription(
      [
        'Transaction lifecycle and commission distribution service for estate agencies.',
        '',
        '- Monetary amounts are integer **minor units** (e.g. pence for GBP).',
        '- Transaction stages advance forward one step at a time.',
        '- Commission breakdowns are immutable snapshots written atomically',
        '  when a transaction reaches `completed`.',
        '- All errors share the `GlobalExceptionFilter` envelope with a',
        '  machine-readable `errorCode`.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .setContact(
      'Iceberg Digital UK',
      'https://iceberg.digital',
      'engineering@iceberg.digital',
    )
    .setLicense('UNLICENSED', 'https://iceberg.digital')
    .addServer(`http://localhost:${port}/${apiPrefix}`, 'Local dev')
    .addTag('Health', 'Liveness & readiness probes.')
    .addTag('Agents', 'Agent directory (create, list, deactivate).')
    .addTag('Transactions', 'Transaction lifecycle & stage history.')
    .addTag('Commissions', 'Commission breakdowns & aggregates (read-only).')
    .addTag('Reports', 'Dashboard snapshot & commissions report + CSV export.')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    customSiteTitle: 'Estate Commission Flow — API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
    },
  });

  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(
    `Estate Commission Flow API running on http://localhost:${port}/${apiPrefix} (${nodeEnv})`,
  );
  logger.log(`Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(`CORS origin allowed: ${frontendUrl}`);
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
