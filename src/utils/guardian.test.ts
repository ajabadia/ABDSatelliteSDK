import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateAccess } from './guardian';

describe('evaluateAccess SDK Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ABD_INTERNAL_SECRET = 'test-secret';
    process.env.GOVERNANCE_API_URL = 'http://localhost:5002';
  });

  it('should deny access and return SDK_SECRET_MISSING if ABD_INTERNAL_SECRET is missing', async () => {
    delete process.env.ABD_INTERNAL_SECRET;

    const result = await evaluateAccess({
      tenantId: 't1',
      userId: 'u1',
      resource: 'doc',
      action: 'view'
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('SDK_SECRET_MISSING');
  });

  it('should return allowed decision on successful status 200 response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        allowed: true,
        reason: 'Policy match',
        allowedSpaceIds: ['space-1'],
        allowedGroupIds: ['group-1']
      })
    });
    global.fetch = fetchSpy;

    const result = await evaluateAccess({
      tenantId: 't1',
      userId: 'u1',
      resource: 'doc',
      action: 'view'
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('Policy match');
    expect(result.allowedSpaceIds).toEqual(['space-1']);
    expect(result.allowedGroupIds).toEqual(['group-1']);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('should deny access and return API status code if response is not ok', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden'
    });
    global.fetch = fetchSpy;

    const result = await evaluateAccess({
      tenantId: 't1',
      userId: 'u1',
      resource: 'doc',
      action: 'view'
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('GUARDIAN_API_STATUS_403');
  });

  it('should return GUARDIAN_API_UNREACHABLE on network throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await evaluateAccess({
      tenantId: 't1',
      userId: 'u1',
      resource: 'doc',
      action: 'view'
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('GUARDIAN_API_UNREACHABLE');
  });
});
