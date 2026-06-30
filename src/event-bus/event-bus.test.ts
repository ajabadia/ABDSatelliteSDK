import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { z } from 'zod/v4';

vi.mock('@upstash/redis', () => {
  return {
    Redis: class {
      xadd() { return '123-0'; }
      xread() { return null; }
    },
  };
});

describe('Event Bus with Redis Streams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  });

  let registeredType: string;

  beforeAll(async () => {
    const { registerSchema } = await import('./schema-registry');
    registeredType = 'eb1.test.event';
    registerSchema(registeredType, z.object({ foo: z.string() }), 'Test event for publisher');
  });

  it('createPublisher should format and publish event correctly via xadd', async () => {
    const { Redis } = await import('@upstash/redis');
    const xaddSpy = vi.spyOn(Redis.prototype, 'xadd');

    const { createPublisher } = await import('./publisher');
    const publisher = createPublisher({ source: 'test-source' });

    const eventId = await publisher.publish(registeredType, { foo: 'bar' }, 'sub-1');
    expect(eventId).toBeDefined();
    expect(xaddSpy).toHaveBeenCalled();
  });

  it('createConsumer should poll and route events to handlers', async () => {
    const { Redis } = await import('@upstash/redis');
    const { createConsumer } = await import('./consumer');

    const mockEnvelope = {
      id: 'e-1',
      type: 'test.event',
      source: 'test-source',
      data: { hello: 'world' },
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
    };

    const xreadSpy = vi.spyOn(Redis.prototype, 'xread').mockResolvedValue([
      [
        'events:test.event',
        [
          ['12345-0', ['payload', JSON.stringify(mockEnvelope)]]
        ]
      ]
    ]);

    const consumer = createConsumer({ source: 'test-source', pollIntervalMs: 100 });
    const handler = vi.fn();
    consumer.on('test.event', handler);

    await consumer.pollOnce();

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      id: 'e-1',
      type: 'test.event',
    }));
  });
});

describe('Schema Registry', () => {
  const TestSchema = z.object({
    name: z.string(),
    age: z.number().optional(),
  });

  it('should register and retrieve schema', async () => {
    const { registerSchema, getSchema, hasSchema } = await import('./schema-registry');
    const version = registerSchema('sr1.user.created', TestSchema, 'User created event');
    expect(version).toBe(1);
    expect(hasSchema('sr1.user.created')).toBe(true);

    const entry = getSchema('sr1.user.created');
    expect(entry).not.toBeNull();
    expect(entry!.version).toBe(1);
    expect(entry!.description).toBe('User created event');
  });

  it('should increment version on re-registration', async () => {
    const { registerSchema, getSchema } = await import('./schema-registry');
    const v2 = registerSchema('sr2.user.created', TestSchema);
    const v3 = registerSchema('sr2.user.created', TestSchema);
    expect(v3).toBe(2);

    const entry = getSchema('sr2.user.created', 2);
    expect(entry).not.toBeNull();
    expect(entry!.version).toBe(2);
  });

  it('should get latest version', async () => {
    const { registerSchema, getLatestVersion } = await import('./schema-registry');
    registerSchema('sr3.user.created', TestSchema);
    expect(getLatestVersion('sr3.user.created')).toBe(1);
    expect(getLatestVersion('sr3.nonexistent')).toBe(0);
  });

  it('should return null for unregistered type', async () => {
    const { hasSchema, getSchema } = await import('./schema-registry');
    expect(hasSchema('sr4.unknown')).toBe(false);
    expect(getSchema('sr4.unknown')).toBeNull();
  });

  it('should validate valid envelope data', async () => {
    const { registerSchema, validateEnvelope } = await import('./schema-registry');
    registerSchema('sr5.event', TestSchema);
    const envelope = {
      id: 'e-1',
      type: 'sr5.event',
      source: 'test',
      data: { name: 'John' },
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
    };

    const result = validateEnvelope(envelope);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid envelope data', async () => {
    const { registerSchema, validateEnvelope } = await import('./schema-registry');
    registerSchema('sr6.event', TestSchema);
    const envelope = {
      id: 'e-2',
      type: 'sr6.event',
      source: 'test',
      data: { name: 123 },
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
    };

    const result = validateEnvelope(envelope);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject unregistered event type', async () => {
    const { validateEnvelope } = await import('./schema-registry');
    const envelope = {
      id: 'e-3',
      type: 'sr7.nonexistent',
      source: 'test',
      data: {},
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
    };

    const result = validateEnvelope(envelope);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No schema registered');
  });

  it('should warn on potentially backward-incompatible schema', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { registerSchema } = await import('./schema-registry');
    registerSchema('sr8.event', z.object({ name: z.string().optional() }));
    registerSchema('sr8.event', z.object({ name: z.number() }));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('Publisher with Schema Validation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  });

  it('should reject publishing invalid data against registered schema', async () => {
    const { registerSchema } = await import('./schema-registry');
    const { createPublisher } = await import('./publisher');

    registerSchema('pv1.order.created', z.object({ orderId: z.string(), amount: z.number() }));

    const publisher = createPublisher({ source: 'test' });
    const result = await publisher.publish('pv1.order.created', { orderId: 'abc', amount: 'not-a-number' });

    expect(result).toBeNull();
  });

  it('should accept valid data against registered schema', async () => {
    const { Redis } = await import('@upstash/redis');
    const xaddSpy = vi.spyOn(Redis.prototype, 'xadd');

    const { registerSchema } = await import('./schema-registry');
    const { createPublisher } = await import('./publisher');

    registerSchema('pv2.order.created', z.object({ orderId: z.string(), amount: z.number() }));

    const publisher = createPublisher({ source: 'test' });
    const result = await publisher.publish('pv2.order.created', { orderId: 'abc', amount: 100 });

    expect(result).toBeDefined();
    expect(xaddSpy).toHaveBeenCalled();
  });

  it('should accept explicit schemaVersion parameter', async () => {
    const { Redis } = await import('@upstash/redis');
    const xaddSpy = vi.spyOn(Redis.prototype, 'xadd');

    const { registerSchema } = await import('./schema-registry');
    const { createPublisher } = await import('./publisher');

    registerSchema('pv3.order.created', z.object({ orderId: z.string() }));
    registerSchema('pv3.order.created', z.object({ orderId: z.string(), status: z.string() }));

    const publisher = createPublisher({ source: 'test' });
    const result = await publisher.publish('pv3.order.created', { orderId: 'abc', status: 'pending' }, undefined, 2);

    expect(result).toBeDefined();
    expect(xaddSpy).toHaveBeenCalled();
  });
});

describe('Consumer with Schema Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  });

  it('should skip events that fail schema validation when validateSchema is enabled', async () => {
    const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { Redis } = await import('@upstash/redis');
    const { createConsumer } = await import('./consumer');
    const { registerSchema } = await import('./schema-registry');

    registerSchema('cv1.validated.event', z.object({ required: z.string() }));

    const invalidEnvelope = {
      id: 'e-invalid',
      type: 'cv1.validated.event',
      source: 'test',
      data: { wrong: 'data' },
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
    };

    vi.spyOn(Redis.prototype, 'xread').mockResolvedValue([
      [
        'events:cv1.validated.event',
        [
          ['12345-0', ['payload', JSON.stringify(invalidEnvelope)]]
        ]
      ]
    ]);

    const consumer = createConsumer({ source: 'test', pollIntervalMs: 100, validateSchema: true });
    const handler = vi.fn();
    consumer.on('cv1.validated.event', handler);

    await consumer.pollOnce();

    expect(handler).not.toHaveBeenCalled();
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping event'),
    );
    mockConsoleWarn.mockRestore();
  });

  it('should process valid events when validateSchema is enabled', async () => {
    const { Redis } = await import('@upstash/redis');
    const { createConsumer } = await import('./consumer');
    const { registerSchema } = await import('./schema-registry');

    registerSchema('cv2.validated.event', z.object({ name: z.string() }));

    const validEnvelope = {
      id: 'e-valid',
      type: 'cv2.validated.event',
      source: 'test',
      data: { name: 'Alice' },
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
    };

    vi.spyOn(Redis.prototype, 'xread').mockResolvedValue([
      [
        'events:cv2.validated.event',
        [
          ['12345-0', ['payload', JSON.stringify(validEnvelope)]]
        ]
      ]
    ]);

    const consumer = createConsumer({ source: 'test', pollIntervalMs: 100, validateSchema: true });
    const handler = vi.fn();
    consumer.on('cv2.validated.event', handler);

    await consumer.pollOnce();

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'e-valid' }));
  });
});

describe('Index exports', () => {
  it('should export schema registry functions from event-bus index', async () => {
    const mod = await import('./index');
    expect(mod.registerSchema).toBeDefined();
    expect(mod.getSchema).toBeDefined();
    expect(mod.getLatestVersion).toBeDefined();
    expect(mod.hasSchema).toBeDefined();
    expect(mod.validateEnvelope).toBeDefined();
  });
});