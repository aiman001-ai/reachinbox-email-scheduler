import nodemailer from 'nodemailer';
import { config } from './env';

let cachedTransporter: nodemailer.Transporter | null = null;
let activeAccount: { user: string; pass: string } | null = null;

export const getMailTransporter = async (): Promise<nodemailer.Transporter> => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (config.smtp.user && config.smtp.pass) {
    activeAccount = {
      user: config.smtp.user,
      pass: config.smtp.pass,
    };

    cachedTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: activeAccount.user,
        pass: activeAccount.pass,
      },
    });

    console.log(`[SMTP] Using configured Ethereal account: ${activeAccount.user}`);
    return cachedTransporter;
  }

  console.log('[SMTP] No static credentials found. Generating automatic Ethereal test account...');
  const testAccount = await nodemailer.createTestAccount();
  activeAccount = {
    user: testAccount.user,
    pass: testAccount.pass,
  };

  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log(`[SMTP] Generated Ethereal credentials:`);
  console.log(`       User: ${testAccount.user}`);
  console.log(`       Pass: ${testAccount.pass}`);
  console.log(`       Web Login: https://ethereal.email/login`);

  return cachedTransporter;
};

export const getActiveAccount = () => activeAccount;
