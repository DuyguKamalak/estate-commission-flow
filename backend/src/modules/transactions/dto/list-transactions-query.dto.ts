import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({ enum: TransactionStage })
  @IsOptional()
  @IsEnum(TransactionStage)
  stage?: TransactionStage;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional({
    description: 'Filter by listing agent ObjectId.',
    example: '69e19d0e193d67beb17fa541',
  })
  @IsOptional()
  @IsMongoId()
  listingAgentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by selling agent ObjectId.',
    example: '69e19d0e193d67beb17fa543',
  })
  @IsOptional()
  @IsMongoId()
  sellingAgentId?: string;

  @ApiPropertyOptional({
    description:
      'Matches an agent in EITHER the listing or selling slot. Takes precedence over the individual listing/selling filters.',
    example: '69e19d0e193d67beb17fa541',
  })
  @IsOptional()
  @IsMongoId()
  anyAgentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by full reference code (uppercased server-side).',
    example: 'TRX-2026-AKZMN7',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @Matches(/^TRX-\d{4}-[A-Z0-9]{6}$/)
  referenceCode?: string;

  @ApiPropertyOptional({
    description:
      'Case-insensitive substring match against `propertyTitle` and `propertyAddress`.',
    maxLength: 100,
    example: 'primrose',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Inclusive lower bound on `createdAt` (ISO 8601).',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound on `createdAt` (ISO 8601).',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
