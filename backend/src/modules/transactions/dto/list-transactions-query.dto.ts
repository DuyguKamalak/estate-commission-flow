import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TransactionStage } from '../../../common/enums/transaction-stage.enum';
import { TransactionType } from '../../../common/enums/transaction-type.enum';

export class ListTransactionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TransactionStage)
  stage?: TransactionStage;

  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @IsOptional()
  @IsMongoId()
  listingAgentId?: string;

  @IsOptional()
  @IsMongoId()
  sellingAgentId?: string;

  /**
   * Matches a single agent in EITHER the listing or selling slot.
   * Takes precedence over the individual listing/selling filters when set,
   * which is what the "Agent Profile" screen needs.
   */
  @IsOptional()
  @IsMongoId()
  anyAgentId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @Matches(/^TRX-\d{4}-[A-Z0-9]{6}$/)
  referenceCode?: string;

  /**
   * Case-insensitive substring match against propertyTitle and propertyAddress.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Inclusive lower bound on `createdAt`. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive upper bound on `createdAt`. */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
