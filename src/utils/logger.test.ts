import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, redactPII, configureLogger } from './logger';

describe('Centralized Logger - PII Redaction', () => {
  it('should redact emails, credit cards, and sensitive keys from strings', () => {
    expect(redactPII('my email is test@example.com')).toBe('my email is [REDACTED_EMAIL]');
    expect(redactPII('card 4111 1111 1111 1111')).toBe('card [REDACTED_CARD]');
    expect(redactPII('password123', 'password')).toBe('[REDACTED]');
    expect(redactPII('some-jwt-token', 'jwt')).toBe('[REDACTED]');
    expect(redactPII('some-secret', 'clientSecret')).toBe('[REDACTED]');
  });

  it('should recursively redact PII from nested objects and arrays', () => {
    const sensitiveObj = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        metadata: {
          secretToken: 'abc-123-xyz',
          card: '1234-5678-9012-3456',
        }
      },
      tags: ['public', 'john@example.com'],
    };

    const redacted = redactPII(sensitiveObj);

    expect(redacted.user.name).toBe('John Doe');
    expect(redacted.user.email).toBe('[REDACTED_EMAIL]');
    expect(redacted.user.phone).toBe('[REDACTED]');
    expect(redacted.user.metadata.secretToken).toBe('[REDACTED]');
    expect(redacted.user.metadata.card).toBe('[REDACTED_CARD]');
    expect(redacted.tags[0]).toBe('public');
    expect(redacted.tags[1]).toBe('[REDACTED_EMAIL]');
  });

  it('should preserve dates and regex instances', () => {
    const now = new Date();
    const regex = /abc/g;
    const obj = { now, regex };
    const redacted = redactPII(obj);
    expect(redacted.now).toBe(now);
    expect(redacted.regex).toBe(regex);
  });
});

describe('Centralized Logger - Console Output and Levels', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log structured JSON matching the configured minLevel', () => {
    configureLogger({ minLevel: 'INFO', appId: 'test-app' });

    logger.debug('should not print');
    expect(logSpy).not.toHaveBeenCalled();

    logger.info('hello world', { userEmail: 'test@example.com' });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('INFO');
    expect(parsed.appId).toBe('test-app');
    expect(parsed.message).toBe('hello world');
    expect(parsed.meta.userEmail).toBe('[REDACTED_EMAIL]');

    logger.warn('warning message');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsedWarn = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(parsedWarn.level).toBe('WARN');

    logger.error('error message', new Error('Failed to fetch user'));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsedError = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(parsedError.level).toBe('ERROR');
    expect(parsedError.message).toBe('Failed to fetch user');
    expect(parsedError.meta.stack).toBeDefined();
  });
});

describe('Centralized Logger - Audit Transmission', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should transmit audit log and redact dynamic metadata but keep root email intact', async () => {
    configureLogger({
      endpoint: 'http://test-logs/api/logs',
      token: 'secret-token-123',
      appId: 'test-governance',
    });

    const payload = {
      tenantId: 't-123',
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: 'u-456',
      userId: 'u-admin',
      userEmail: 'admin@company.com',
      changedFields: {
        email: 'new-email@company.com',
        phoneNumber: '555-1234',
        name: 'New Name',
      },
      previousState: {
        email: 'old-email@company.com',
        phoneNumber: '555-0000',
        name: 'Old Name',
      },
    };

    logger.audit(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://test-logs/api/logs');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer secret-token-123');

    const sentBody = JSON.parse(init.body);
    expect(sentBody.appId).toBe('test-governance');
    expect(sentBody.userEmail).toBe('admin@company.com'); // Root email MUST NOT be redacted!
    expect(sentBody.changedFields.email).toBe('[REDACTED_EMAIL]'); // Internal email must be redacted!
    expect(sentBody.changedFields.phoneNumber).toBe('[REDACTED]');
    expect(sentBody.changedFields.name).toBe('New Name');
    expect(sentBody.previousState.email).toBe('[REDACTED_EMAIL]');
    expect(sentBody.previousState.phoneNumber).toBe('[REDACTED]');
  });

  it('should be fail-safe when fetch throws', () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('Network error')));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      logger.audit({
        tenantId: 't-123',
        action: 'DELETE',
        entityType: 'SYSTEM',
        entityId: 'sys-1',
        userId: 'admin',
        userEmail: 'admin@company.com',
      });
    }).not.toThrow();
  });
});
