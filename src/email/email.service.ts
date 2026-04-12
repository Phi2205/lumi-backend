import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (sendgridApiKey) {
      // ✅ Use SendGrid if API Key is available
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: sendgridApiKey,
        },
      });
      console.log('✅ Email service configured with SendGrid');
    } else {
      // ✅ Fallback to Gmail or other SMTP
      if (!smtpUser || !smtpPass) {
        console.warn(
          '⚠️  No SMTP or SendGrid credentials configured. Email service will not work.',
        );
      }

      const transportConfig: any = {
        host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
        port: this.configService.get<number>('SMTP_PORT') || 587,
        secure: false,
      };

      if (smtpUser && smtpPass) {
        transportConfig.auth = {
          user: smtpUser,
          pass: smtpPass,
        };
      }
      this.transporter = nodemailer.createTransport(transportConfig);
    }
  }

  async sendOTP(email: string, otp: string): Promise<void> {
    const sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!sendgridApiKey && (!smtpUser || !smtpPass)) {
      throw new Error(
        'Email credentials not configured. Please set SENDGRID_API_KEY or SMTP credentials in .env file',
      );
    }

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM') || smtpUser,
      to: email,
      subject: 'Your OTP Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">OTP Verification Code</h2>
          <p>Hello,</p>
          <p>Your OTP verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}
