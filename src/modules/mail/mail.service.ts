import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('mail.from')!;
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: this.configService.get<boolean>('mail.secure'),
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.password'),
      },
    });
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (error) {
      // Registration/approval flows must not fail just because SMTP is
      // temporarily unavailable - the user can always request a resend.
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`);
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.send(
      to,
      'Verify your email address',
      `<p>Your email verification code is:</p><h2>${code}</h2><p>This code expires in 15 minutes.</p>`,
    );
  }

  async sendPasswordResetToken(to: string, token: string): Promise<void> {
    await this.send(
      to,
      'Password reset request',
      `<p>Your password reset code is:</p><h2>${token}</h2><p>This code expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
    );
  }

  async sendAccountApproved(to: string): Promise<void> {
    await this.send(
      to,
      'Your account has been approved',
      '<p>Your account has been approved by an administrator. You can now log in.</p>',
    );
  }

  async sendAccountRejected(to: string, reason: string): Promise<void> {
    await this.send(
      to,
      'Your registration was rejected',
      `<p>Your registration request was rejected.</p><p>Reason: ${escapeHtml(reason)}</p>`,
    );
  }

  async sendAccountBlocked(to: string, reason: string): Promise<void> {
    await this.send(
      to,
      'Your account has been blocked',
      `<p>Your account has been blocked by an administrator.</p><p>Reason: ${escapeHtml(reason)}</p>`,
    );
  }
}
