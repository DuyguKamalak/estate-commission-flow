import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Mutable fields on an existing transaction.
 *
 * Stage, per-stage dates, reference code, agents and the fee itself are
 * intentionally NOT included — they either have dedicated endpoints
 * (`advanceStage`) or are immutable once set, to protect the audit trail
 * and commission reproducibility.
 */
export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  propertyTitle?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  propertyAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
