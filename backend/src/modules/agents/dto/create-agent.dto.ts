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
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @IsString()
  @Length(1, 100)
  lastName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  // Permissive phone check — allow digits, space, plus, hyphen, parentheses.
  @Matches(/^[+\d\s\-()]+$/, {
    message: 'phone must contain only digits and + - ( ) space characters',
  })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
