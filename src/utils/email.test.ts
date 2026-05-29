import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResendEmailService } from './email';

describe('ResendEmailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('should throw error if RESEND_API_KEY is not defined', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = 'test@example.com';

    await expect(
      ResendEmailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      })
    ).rejects.toThrow('Missing RESEND_API_KEY environment variable.');
  });

  it('should throw error if from is not defined (both options and env)', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    delete process.env.RESEND_FROM_EMAIL;

    await expect(
      ResendEmailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      })
    ).rejects.toThrow('Missing from sender address');
  });

  it('should send email successfully with default from address', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_FROM_EMAIL = 'default@example.com';

    const mockFetch = vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'email_id_123' }),
    } as Response);

    const result = await ResendEmailService.sendEmail({
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(result).toEqual({ id: 'email_id_123' });
    expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'default@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: undefined,
      }),
    });
  });

  it('should prioritize options.from over process.env.RESEND_FROM_EMAIL', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_FROM_EMAIL = 'default@example.com';

    const mockFetch = vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'email_id_456' }),
    } as Response);

    const result = await ResendEmailService.sendEmail({
      from: 'custom@example.com',
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(result).toEqual({ id: 'email_id_456' });
    expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'custom@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: undefined,
      }),
    });
  });

  it('should handle API errors correctly', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_FROM_EMAIL = 'default@example.com';

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Invalid API Key' } }),
    } as Response);

    await expect(
      ResendEmailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      })
    ).rejects.toThrow('Resend API failed: Invalid API Key');
  });
});
