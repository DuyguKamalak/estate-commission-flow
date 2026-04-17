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
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[+\d\s\-()]+$/, {
    message: 'phone must contain only digits and + - ( ) space characters',
  })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
