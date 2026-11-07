/**
 * Email Service — SMTP via Nodemailer + mailto: fallback.
 */
import nodemailer from 'nodemailer';
import { settingsRepo } from '../database/repositories/settings.repo.js';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

export function getEmailConfig(): EmailConfig {
  return {
    host: settingsRepo.getTyped<string>('smtp_host', ''),
    port: settingsRepo.getTyped<number>('smtp_port', 587),
    user: settingsRepo.getTyped<string>('smtp_user', ''),
    pass: settingsRepo.getTyped<string>('smtp_pass', ''),
    from: settingsRepo.getTyped<string>('smtp_from', ''),
    secure: settingsRepo.getTyped<boolean>('smtp_secure', false),
  };
}

export function isEmailConfigured(): boolean {
  const config = getEmailConfig();
  return !!(config.host && config.user && config.pass);
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; message: string }> {
  const config = getEmailConfig();

  if (!isEmailConfigured()) {
    return {
      success: false,
      message: 'SMTP email is not configured. Please set up SMTP in Settings or use the mailto: fallback.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.sendMail({
      from: config.from || config.user,
      to: params.to,
      subject: params.subject,
      html: params.bodyHtml,
      text: params.bodyText,
      attachments: params.attachments,
    });

    return { success: true, message: 'Email sent successfully' };
  } catch (err: any) {
    console.error('[Email] Send failed:', err.message);
    return {
      success: false,
      message: `Failed to send email: ${err.message}`,
    };
  }
}

/**
 * Generate a mailto: URI as a fallback when SMTP is not configured.
 * Note: mailto: does not support attachments, so we include a note.
 */
export function generateMailtoUri(params: {
  to: string;
  subject: string;
  body: string;
}): string {
  const encodedSubject = encodeURIComponent(params.subject);
  const encodedBody = encodeURIComponent(params.body);
  return `mailto:${params.to}?subject=${encodedSubject}&body=${encodedBody}`;
}
