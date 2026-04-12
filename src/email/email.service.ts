import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private mailService: MailService;

  constructor(private configService: ConfigService) {
    this.mailService = new MailService();
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');

    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY not configured');
    }

    this.mailService.setApiKey(apiKey);
    console.log('✅ Email service using SendGrid API Service');
  }

  async sendOTP(email: string, otp: string): Promise<void> {
    const fromEmail = this.configService.get<string>('SMTP_FROM');

    const msg = {
      to: email,
      from: fromEmail || 'duongphidis@gmail.com',
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
      await this.mailService.send(msg);
      console.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending email via SendGrid:', error);
      if (error.response) {
        console.error(JSON.stringify(error.response.body));
      }
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}
