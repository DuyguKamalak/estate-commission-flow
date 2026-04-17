import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsMongoId, IsOptional } from 'class-validator';

/**
 * Query params for aggregating commission shares across transactions.
 *
 * All fields optional. When `agentId` is provided, results are scoped
 * to that agent. `from`/`to` bound the calculatedAt window inclusively.
 */
export class AggregateCommissionsQueryDto {
  @ApiPropertyOptional({ example: '69e19d0e193d67beb17fa541' })
  @IsOptional()
  @IsMongoId()
  agentId?: string;

  @ApiPropertyOptional({ example: '2026-04-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-04-30T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
