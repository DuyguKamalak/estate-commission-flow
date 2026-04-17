import { ApiProperty } from '@nestjs/swagger';
import { ErrorCode } from '../enums/error-code.enum';

/**
 * Canonical error body produced by `GlobalExceptionFilter`.
 *
 * Documented here (rather than generated from the filter on the fly)
 * so Swagger renders a single, stable schema that every error-returning
 * endpoint references. Client integrators only need to learn this
 * shape once to handle failures consistently.
 */
export class ApiErrorDto {
  @ApiProperty({ example: 400, description: 'HTTP status code.' })
  statusCode!: number;

  @ApiProperty({
    enum: ErrorCode,
    example: ErrorCode.VALIDATION_ERROR,
    description:
      'Stable, machine-readable identifier — clients may branch on this.',
  })
  errorCode!: ErrorCode;

  @ApiProperty({
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' } },
    ],
    example: 'propertyTitle must be longer than or equal to 1 characters',
    description:
      'Human-readable message. For validation failures this is an array of messages, one per failed constraint.',
  })
  message!: string | string[];

  @ApiProperty({
    example: '2026-04-17T03:45:00.000Z',
    description: 'ISO 8601 UTC timestamp at which the error was produced.',
  })
  timestamp!: string;

  @ApiProperty({
    example: '/api/transactions',
    description: 'Request path that produced the error.',
  })
  path!: string;
}
