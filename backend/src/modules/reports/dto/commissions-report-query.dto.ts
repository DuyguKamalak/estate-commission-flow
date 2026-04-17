import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * Query parameters for the commissions report.
 *
 * `from` / `to` bound `calculatedAt` inclusively. When only one side
 * is provided the other is left open (no boundary). Dates must be
 * ISO 8601 strings; the service converts to `Date`. Timezone is
 * honoured if supplied, otherwise the raw `Date(string)` fallback
 * treats the value as UTC (a plain date like "2026-04-01" is parsed
 * as the start of that UTC day).
 *
 * `currency` filters to a single ISO 4217 code; we uppercase
 * defensively because the DB stores uppercased values.
 */
export class CommissionsReportQueryDto {
  @ApiPropertyOptional({
    description: 'Inclusive lower bound on `calculatedAt` (ISO 8601).',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound on `calculatedAt` (ISO 8601).',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description: 'Filter to breakdowns where this agent received a share.',
    example: '69e19d0e193d67beb17fa541',
  })
  @IsOptional()
  @IsMongoId()
  agentId?: string;

  @ApiPropertyOptional({
    description: 'ISO 4217 three-letter code, uppercased server-side.',
    example: 'GBP',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'currency must be a 3-letter ISO 4217 code.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  currency?: string;
}
