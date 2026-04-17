import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TransactionStage } from '../../../common/enums/transaction-stage.enum';

/**
 * Request to move a transaction to its next lifecycle stage.
 *
 * The `toStage` is validated by the stage machine — only a single step
 * forward from the current stage is accepted. Reaching COMPLETED also
 * persists the commission breakdown atomically (see TransactionsService).
 */
export class AdvanceStageDto {
  @IsEnum(TransactionStage)
  toStage!: TransactionStage;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  triggeredBy?: string;
}
