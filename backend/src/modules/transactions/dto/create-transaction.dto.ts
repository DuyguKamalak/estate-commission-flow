import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    example: 'Primrose Hill penthouse',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  propertyTitle!: string;

  @ApiProperty({
    example: '12 Primrose Hill, London NW1 8XL',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @Length(1, 500)
  propertyAddress!: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.SALE })
  @IsEnum(TransactionType)
  transactionType!: TransactionType;

  @ApiProperty({
    description:
      'Total service fee in integer MINOR UNITS (e.g. pence for GBP). 100001 = £1,000.01.',
    example: 100001,
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalServiceFee!: number;

  @ApiPropertyOptional({
    description: 'ISO 4217 three-letter code. Defaults to GBP.',
    example: 'GBP',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({
    description: 'ObjectId of the listing agent (must be active).',
    example: '69e19d0e193d67beb17fa541',
  })
  @IsMongoId()
  listingAgentId!: string;

  @ApiProperty({
    description:
      'ObjectId of the selling agent (may equal `listingAgentId` for the same-agent case).',
    example: '69e19d0e193d67beb17fa543',
  })
  @IsMongoId()
  sellingAgentId!: string;

  @ApiPropertyOptional({
    description: 'ISO 8601. Defaults to now (UTC) if omitted.',
    example: '2026-04-17T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  agreementDate?: string;

  @ApiPropertyOptional({
    description: 'Free-text notes. Max 2 000 characters.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
