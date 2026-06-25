import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  it('createPublisher should format and publish event correctly via xadd', async () => {
    const { Redis } = await import('@upstash/redis');
    const xaddSpy = vi.spyOn(Redis.prototype, 'xadd');

    const { createPublisher } = await import('./publisher');
    const publisher = createPublisher({ source: 'test-source' });
    
    const eventId = await publisher.publish('test.event', { foo: 'bar' }, 'sub-1');
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
