import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../enums/error-code.enum';
import { DomainException } from '../exceptions/domain.exception';

export interface ErrorResponseBody {
  timestamp: string;
  path: string;
  method: string;
  statusCode: number;
  errorCode: ErrorCode | string;
  message: string | string[];
}

/**
 * Converts every uncaught error into a uniform JSON shape:
 *
 *   {
 *     timestamp, path, method,
 *     statusCode, errorCode, message
 *   }
 *
 * - DomainException   -> uses its own errorCode
 * - HttpException     -> maps common statuses to ErrorCode enum values
 * - Everything else   -> logged + 500 INTERNAL_ERROR
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { statusCode, errorCode, message } = this.resolveError(exception);

    const body: ErrorResponseBody = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode,
      errorCode,
      message,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode} ${errorCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${statusCode} ${errorCode}: ${
          Array.isArray(message) ? message.join('; ') : message
        }`,
      );
    }

    response.status(statusCode).json(body);
  }

  private resolveError(exception: unknown): {
    statusCode: number;
    errorCode: ErrorCode | string;
    message: string | string[];
  } {
    if (exception instanceof DomainException) {
      const response = exception.getResponse() as { message?: string | string[] };
      return {
        statusCode: exception.getStatus(),
        errorCode: exception.errorCode,
        message: response?.message ?? exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] })?.message ?? exception.message);

      return {
        statusCode: status,
        errorCode: this.mapHttpStatusToErrorCode(status),
        message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    };
  }

  private mapHttpStatusToErrorCode(status: number): ErrorCode | string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      default:
        return HttpStatus[status] ?? `HTTP_${status}`;
    }
  }
}
