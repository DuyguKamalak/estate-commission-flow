import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListAgentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by active state. Omit to return both active and deactivated agents.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Case-insensitive substring match against firstName, lastName and email.',
    maxLength: 100,
    example: 'doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
