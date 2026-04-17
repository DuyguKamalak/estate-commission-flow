import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Update payload for an existing agent.
 *
 * Every field is optional; the service only touches fields that were
 * actually provided, so callers can PATCH a single attribute (e.g. toggle
 * `isActive`) without having to round-trip the full document.
 */
export class UpdateAgentDto {
  @ApiPropertyOptional({ example: 'Jane', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'jane.doe@iceberg.test', maxLength: 254 })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '+44 20 7946 0001', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[+\d\s\-()]+$/, {
    message: 'phone must contain only digits and + - ( ) space characters',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Reactivate (true) or deactivate (false) the agent.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
