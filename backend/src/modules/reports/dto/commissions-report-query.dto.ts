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
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsMongoId()
  agentId?: string;

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
