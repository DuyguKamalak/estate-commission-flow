import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ example: 'Jane', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ example: 'Doe', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiProperty({
    example: 'jane.doe@iceberg.test',
    description: 'Globally unique — a duplicate returns AGENT_EMAIL_IN_USE.',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({
    example: '+44 20 7946 0001',
    description: 'Digits, spaces, + - ( ) are allowed. Max 40 chars.',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  // Permissive phone check — allow digits, space, plus, hyphen, parentheses.
  @Matches(/^[+\d\s\-()]+$/, {
    message: 'phone must contain only digits and + - ( ) space characters',
  })
  phone?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Defaults to true. Use DELETE to deactivate.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
