import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getMailTransporter } from '../config/smtp';

export interface SendMailOptions {
  jobRecordId?: string;
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
    const backendBase =
      process.env.BACKEND_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'http://localhost:4000';

    try {
      const transporter = await getMailTransporter();

      if (transporter) {
        const sendPromise = transporter.sendMail({
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

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SMTP connection timed out')), 4000)
        );

        const info = await Promise.race([sendPromise, timeoutPromise]);
        const testUrl = nodemailer.getTestMessageUrl(info);

        return {
          messageId: info.messageId,
          previewUrl: testUrl || `${backendBase}/api/emails/preview/${options.jobRecordId || crypto.randomUUID()}`,
        };
      }
    } catch (smtpErr) {
      console.warn(
        `[SMTP] Outbound SMTP dispatch blocked or timed out (${(smtpErr as Error).message}). Using built-in preview fallback.`
      );
    }

    const fallbackId = `<mock-${Date.now()}-${crypto.randomBytes(4).toString('hex')}@reachinbox.ai>`;
    const fallbackPreview = `${backendBase}/api/emails/preview/${options.jobRecordId || crypto.randomUUID()}`;

    return {
      messageId: fallbackId,
      previewUrl: fallbackPreview,
    };
  }
}
