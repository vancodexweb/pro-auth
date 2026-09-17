import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Shared by resend-verification and forgot-password - both just need an email. */
export class EmailOnlyDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
