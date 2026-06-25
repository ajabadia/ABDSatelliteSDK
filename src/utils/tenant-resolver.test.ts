import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────

const mockFindOne = vi.fn();

vi.mock('../db/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
  connectAuthDB: vi.fn().mockResolvedValue({
    collection: vi.fn(() => ({
      findOne: mockFindOne,
    })),
  }),
}));

// ── Imports ─────────────────────────────────────────────

import { resolveTargetTenantContext } from './tenant-resolver';
import { connectAuthDB } from '../db/mongodb';

// ── Tests ──────────────────────────────────────────────

describe('resolveTargetTenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Empty tenantId ──

  it('should return undefined when tenantId is undefined', async () => {
    const result = await resolveTargetTenantContext();
    expect(result).toBeUndefined();
  });

  it('should return undefined when tenantId is empty string', async () => {
    const result = await resolveTargetTenantContext('');
    expect(result).toBeUndefined();
  });

  it('should return undefined when tenantId is whitespace', async () => {
    const result = await resolveTargetTenantContext('   ');
    expect(result).toBeUndefined();
  });

  it('should NOT call connectAuthDB when tenantId is empty', async () => {
    await resolveTargetTenantContext();
    expect(connectAuthDB).not.toHaveBeenCalled();
  });

  // ── Connection fails ──

  it('should return undefined when connectAuthDB fails', async () => {
    vi.mocked(connectAuthDB).mockRejectedValueOnce(new Error('Connection error'));

    const result = await resolveTargetTenantContext('tenant-1');
    expect(result).toBeUndefined();
  });

  // ── Successful resolution ──

  it('should resolve tenant context when tenant found', async () => {
    mockFindOne.mockResolvedValue({
      tenantId: 'tenant-1',
      dbPrefix: 't1_',
      isolationStrategy: 'COLLECTION_PREFIX',
    });

    const result = await resolveTargetTenantContext('tenant-1');

    expect(result).toEqual({
      tenantId: 'tenant-1',
      dbPrefix: 't1_',
      isolationStrategy: 'COLLECTION_PREFIX',
    });

    // Verify the query was made to the correct collection + projection
    expect(mockFindOne).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', active: true },
      { projection: { tenantId: 1, dbPrefix: 1, isolationStrategy: 1 } }
    );
  });

  it('should use DATABASE_PER_TENANT isolation strategy when returned', async () => {
    mockFindOne.mockResolvedValue({
      tenantId: 'tenant-2',
      dbPrefix: 't2_',
      isolationStrategy: 'DATABASE_PER_TENANT',
    });

    const result = await resolveTargetTenantContext('tenant-2');

    expect(result).toEqual({
      tenantId: 'tenant-2',
      dbPrefix: 't2_',
      isolationStrategy: 'DATABASE_PER_TENANT',
    });
  });

  // ── Tenant not found ──

  it('should return undefined when tenant not found (null)', async () => {
    mockFindOne.mockResolvedValue(null);

    const result = await resolveTargetTenantContext('nonexistent-tenant');
    expect(result).toBeUndefined();
  });

  // ── Defaults for missing fields ──

  it('should default dbPrefix to "default" when tenant has empty dbPrefix', async () => {
    mockFindOne.mockResolvedValue({
      tenantId: 'tenant-1',
      dbPrefix: '',
      isolationStrategy: 'COLLECTION_PREFIX',
    });

    const result = await resolveTargetTenantContext('tenant-1');

    expect(result).toEqual({
      tenantId: 'tenant-1',
      dbPrefix: 'default',
      isolationStrategy: 'COLLECTION_PREFIX',
    });
  });

  it('should default isolationStrategy to "COLLECTION_PREFIX" when missing', async () => {
    mockFindOne.mockResolvedValue({
      tenantId: 'tenant-1',
      dbPrefix: 't1_',
      isolationStrategy: null,
    });

    const result = await resolveTargetTenantContext('tenant-1');

    expect(result).toEqual({
      tenantId: 'tenant-1',
      dbPrefix: 't1_',
      isolationStrategy: 'COLLECTION_PREFIX',
    });
  });

  // ── Error handling ──

  it('should return undefined when findOne throws', async () => {
    mockFindOne.mockRejectedValue(new Error('Database query failed'));

    const result = await resolveTargetTenantContext('tenant-1');
    expect(result).toBeUndefined();
  });
});
