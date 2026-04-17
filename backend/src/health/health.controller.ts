import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Liveness endpoint for deployment platforms (Render) and smoke tests.
 *
 * Returns a tiny JSON payload describing the running process. The shape is
 * intentionally stable so CI / uptime checks can parse it.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check(): {
    status: 'ok';
    service: string;
    environment: string;
    timestamp: string;
    uptime: number;
  } {
    return {
      status: 'ok',
      service: 'estate-commission-flow-backend',
      environment: this.config.get<string>('app.nodeEnv') ?? 'development',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    };
  }
}
