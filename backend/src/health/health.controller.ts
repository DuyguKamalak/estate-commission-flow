import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Connection } from 'mongoose';

/**
 * Liveness + readiness endpoints for deployment platforms (Render) and
 * smoke tests.
 *
 * - `GET /health`        → Liveness. Returns as long as the process is up.
 *                          Used by the platform's process supervisor to
 *                          decide whether to restart the container.
 * - `GET /health/ready`  → Readiness. Additionally verifies the MongoDB
 *                          connection (and issues a cheap ping) so load
 *                          balancers stop sending traffic when the DB is
 *                          unreachable. Returns 503 on failure.
 *
 * The two are split because a transient DB blip should NOT cause the
 * platform to kill-and-restart the process; it should only pull us out
 * of rotation until the DB recovers.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private static readonly MONGO_READY_STATE_CONNECTED = 1;

  constructor(
    private readonly config: ConfigService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Returns 200 as long as the Node process is running. Does not check downstream dependencies.',
  })
  @ApiOkResponse({ description: 'Process is alive.' })
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

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Returns 200 only when the process AND MongoDB are both healthy. Issues a `{ ping: 1 }` admin command to verify round-trip. Returns 503 otherwise.',
  })
  @ApiOkResponse({ description: 'Service is ready to serve traffic.' })
  @ApiServiceUnavailableResponse({
    description: 'MongoDB is unreachable or not yet connected.',
  })
  async ready(): Promise<{
    status: 'ok';
    checks: {
      mongo: {
        status: 'up';
        readyState: number;
        latencyMs: number;
      };
    };
    timestamp: string;
  }> {
    const readyState = this.mongoConnection.readyState;
    if (readyState !== HealthController.MONGO_READY_STATE_CONNECTED) {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: {
          mongo: {
            status: 'down',
            readyState,
            reason: 'connection-not-ready',
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

    const started = Date.now();
    try {
      // Cheapest possible round-trip: admin `ping` command.
      const admin = this.mongoConnection.db?.admin();
      if (!admin) {
        throw new Error('admin handle unavailable');
      }
      await admin.command({ ping: 1 });
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: {
          mongo: {
            status: 'down',
            readyState,
            reason: err instanceof Error ? err.message : 'ping-failed',
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      checks: {
        mongo: {
          status: 'up',
          readyState,
          latencyMs: Date.now() - started,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
