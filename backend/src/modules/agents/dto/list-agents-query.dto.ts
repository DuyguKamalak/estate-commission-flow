import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListAgentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  /**
   * Free-text search, matched case-insensitively against firstName,
   * lastName and email. Short enough to prevent pathological regex.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
