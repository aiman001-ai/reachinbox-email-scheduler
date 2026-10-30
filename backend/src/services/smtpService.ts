import nodemailer from 'nodemailer';
import { getMailTransporter } from '../config/smtp';

export interface SendMailOptions {
  sender: string;
  recipient: string;
  subject: string;
  body: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
}

export class SmtpService {
  public static async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    const transporter = await getMailTransporter();

    const info = await transporter.sendMail({
      from: options.sender,
      to: options.recipient,
      subject: options.subject,
      text: options.body,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #1e293b;">
          ${options.body.replace(/\n/g, '<br/>')}
          <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e2e8f0;" />
          <p style="font-size: 11px; color: #94a3b8;">
            Sent by ReachInbox Email Job Scheduler (Ethereal Fake SMTP)
          </p>
        </div>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl,
    };
  }
}
