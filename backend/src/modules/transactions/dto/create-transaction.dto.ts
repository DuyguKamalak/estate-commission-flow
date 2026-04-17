import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { TransactionType } from '../../../common/enums/transaction-type.enum';

/**
 * Payload for creating a new transaction.
 *
 * Notes:
 * - `totalServiceFee` is sent in **minor units** (pence for GBP, cents for
 *   EUR, etc.). This matches how the value is stored and calculated — see
 *   ADR-003. Frontend forms convert at the boundary.
 * - `stage`, `referenceCode`, `agreementDate` default, and the various
 *   per-stage dates are NOT accepted here — they are set server-side to
 *   guarantee a consistent audit trail.
 * - `listingAgentId` and `sellingAgentId` may be equal (same-agent case).
 */
export class CreateTransactionDto {
  @IsString()
  @Length(1, 200)
  propertyTitle!: string;

  @IsString()
  @Length(1, 500)
  propertyAddress!: string;

  @IsEnum(TransactionType)
  transactionType!: TransactionType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalServiceFee!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsMongoId()
  listingAgentId!: string;

  @IsMongoId()
  sellingAgentId!: string;

  @IsOptional()
  @IsISO8601()
  agreementDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
