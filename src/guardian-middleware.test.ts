import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withGuardianAccess } from './auth-middleware/guardian-middleware';
import { evaluateAccess } from './utils/guardian';
import { getIndustrialSession } from './auth-middleware/session';
import { getCache, setCache } from './auth-middleware/session/redis-store';

vi.mock('./utils/guardian', () => ({
  evaluateAccess: vi.fn(),
}));

vi.mock('./auth-middleware/session', () => ({
  getIndustrialSession: vi.fn(),
}));

vi.mock('./auth-middleware/session/redis-store', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
}));

describe('withGuardianAccess Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(getIndustrialSession).mockResolvedValue({ authenticated: false });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const middleware = withGuardianAccess({ resource: 'doc', action: 'read' })(handler);

    const req = new NextRequest('http://localhost/api/docs');
    const res = await middleware(req);

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return 403 if evaluateAccess denies access', async () => {
    vi.mocked(getIndustrialSession).mockResolvedValue({
      authenticated: true,
      user: { id: 'u1', tenantId: 't1', role: 'USER', email: 'u1@t1.com', name: '', surname: '', dbPrefix: '', isolationStrategy: '' },
    });
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(evaluateAccess).mockResolvedValue({ allowed: false, reason: 'No Policy', allowedSpaceIds: [], allowedGroupIds: [] });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const middleware = withGuardianAccess({ resource: 'doc', action: 'read' })(handler);

    const req = new NextRequest('http://localhost/api/docs');
    const res = await middleware(req);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(setCache).toHaveBeenCalledWith('guardian:t1:u1:doc:read', { allowed: false, reason: 'No Policy' }, 300);
  });

  it('should pass and call handler if evaluateAccess allows access', async () => {
    vi.mocked(getIndustrialSession).mockResolvedValue({
      authenticated: true,
      user: { id: 'u1', tenantId: 't1', role: 'USER', email: 'u1@t1.com', name: '', surname: '', dbPrefix: '', isolationStrategy: '' },
    });
    vi.mocked(getCache).mockResolvedValue(null);
    vi.mocked(evaluateAccess).mockResolvedValue({ allowed: true, reason: 'Allowed by policy', allowedSpaceIds: [], allowedGroupIds: [] });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const middleware = withGuardianAccess({ resource: 'doc', action: 'read' })(handler);

    const req = new NextRequest('http://localhost/api/docs');
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(setCache).toHaveBeenCalledWith('guardian:t1:u1:doc:read', { allowed: true, reason: 'Allowed by policy' }, 300);
  });

  it('should read from cache if available', async () => {
    vi.mocked(getIndustrialSession).mockResolvedValue({
      authenticated: true,
      user: { id: 'u1', tenantId: 't1', role: 'USER', email: 'u1@t1.com', name: '', surname: '', dbPrefix: '', isolationStrategy: '' },
    });
    vi.mocked(getCache).mockResolvedValue({ allowed: true, reason: 'Cached allowed', allowedSpaceIds: [], allowedGroupIds: [] });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const middleware = withGuardianAccess({ resource: 'doc', action: 'read' })(handler);

    const req = new NextRequest('http://localhost/api/docs');
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(evaluateAccess).not.toHaveBeenCalled();
  });
});
