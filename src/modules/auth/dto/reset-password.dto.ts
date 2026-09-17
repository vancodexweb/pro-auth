import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Match } from '../../../common/validators/match.decorator';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'newPassword must contain at least one uppercase letter, one lowercase letter and one digit',
  })
  newPassword: string;

  @ApiProperty()
  @IsString()
  @Match('newPassword')
  newPasswordConfirmation: string;
}
