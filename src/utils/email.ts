/**
 * @purpose Proporciona un correo electrónico mediante API de reenvío.
 * @purpose_en Sends an email using the Resend API.
 * @refactorable false
 * @classification Business Service
 * @complexity Low
 * @fingerprint exports:2,imports:0,sig:2912dp
 * @lastUpdated 2026-06-23T23:25:22.366Z
 */

export interface ResendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export class ResendEmailService {
  /**
   * Envia un correo electrónico utilizando la API REST de Resend.
   * Evita añadir dependencias pesadas de terceros al SDK.
   */
  static async sendEmail(options: ResendEmailOptions): Promise<{ id: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    const defaultFrom = process.env.RESEND_FROM_EMAIL;

    if (!apiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable.');
    }

    const from = options.from || defaultFrom;
    if (!from) {
      throw new Error('Missing from sender address (either options.from or RESEND_FROM_EMAIL).');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.message || data?.error?.message || 'Unknown Resend Error';
      throw new Error(`Resend API failed: ${errorMsg}`);
    }

    return { id: data.id };
  }
}
