import { IsISO8601, IsMongoId, IsOptional } from 'class-validator';

/**
 * Query params for aggregating commission shares across transactions.
 *
 * All fields optional. When `agentId` is provided, results are scoped
 * to that agent. `from`/`to` bound the calculatedAt window inclusively.
 */
export class AggregateCommissionsQueryDto {
  @IsOptional()
  @IsMongoId()
  agentId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
