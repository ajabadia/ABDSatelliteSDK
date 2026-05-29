import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────

vi.mock('./mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

const mockFindOne = vi.fn();

vi.mock('mongoose', () => ({
  default: {
    connection: {
      readyState: 1,
      useDb: vi.fn(() => ({
        collection: vi.fn(() => ({
          findOne: mockFindOne,
        })),
      })),
    },
  },
}));

// ── Imports ─────────────────────────────────────────────

import { resolveTargetTenantContext } from './tenant-resolver';

// ── Tests ──────────────────────────────────────────────

describe('resolveTargetTenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MONGODB_AUTH_DB = 'ABDElevators-Auth';
  });

  afterEach(() => {
    delete process.env.MONGODB_AUTH_DB;
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

  it('should NOT call connectDB or mongoose when tenantId is empty', async () => {
    await resolveTargetTenantContext();

    const connectDB = (await import('./mongodb')).connectDB;
    expect(connectDB).not.toHaveBeenCalled();
  });

  // ── Connection not ready ──

  it('should return undefined when mongoose connection is not ready', async () => {
    // Override readyState for this test
    const mongoose = await import('mongoose');
    const origReadyState = (mongoose.default.connection as { readyState: number }).readyState;
    (mongoose.default.connection as { readyState: number }).readyState = 0;

    const result = await resolveTargetTenantContext('tenant-1');
    expect(result).toBeUndefined();

    // Restore
    (mongoose.default.connection as { readyState: number }).readyState = origReadyState;
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
    mockFindOne.mockRejectedValue(new Error('Database connection failed'));

    const result = await resolveTargetTenantContext('tenant-1');
    expect(result).toBeUndefined();
  });

  it('should return undefined when useDb throws', async () => {
    const mongoose = await import('mongoose');
    const origUseDb = (mongoose.default.connection as { useDb: (...args: never[]) => unknown }).useDb;
    (mongoose.default.connection as { useDb: (...args: never[]) => unknown }).useDb = vi.fn(() => {
      throw new Error('Invalid database');
    });

    const result = await resolveTargetTenantContext('tenant-1');
    expect(result).toBeUndefined();

    // Restore
    (mongoose.default.connection as { useDb: (...args: never[]) => unknown }).useDb = origUseDb;
  });

  it('should use MONGODB_AUTH_DB env var when set', async () => {
    mockFindOne.mockResolvedValue({
      tenantId: 'custom',
      dbPrefix: 'c_',
      isolationStrategy: 'COLLECTION_PREFIX',
    });

    process.env.MONGODB_AUTH_DB = 'CustomAuthDB';
    await resolveTargetTenantContext('custom');

    // Verify useDb was called with the custom name
    const mongoose = await import('mongoose');
    expect(mongoose.default.connection.useDb).toHaveBeenCalledWith(
      'CustomAuthDB',
      { useCache: true }
    );
  });
});
