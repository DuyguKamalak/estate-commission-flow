import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api';
  const frontendUrl = config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
  const port = config.get<number>('app.port') ?? 3001;

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

  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Estate Commission Flow API running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`CORS origin allowed: ${frontendUrl}`);
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
