import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    enum: TransactionStage,
    example: TransactionStage.EARNEST_MONEY,
    description:
      'Target stage — must be exactly one step ahead of the current stage.',
  })
  @IsEnum(TransactionStage)
  toStage!: TransactionStage;

  @ApiPropertyOptional({
    description: 'Free-text reason recorded on the stage history row.',
    example: 'Buyer deposited earnest money',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Operator / system that initiated the transition.',
    example: 'A. Operator',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  triggeredBy?: string;
}
