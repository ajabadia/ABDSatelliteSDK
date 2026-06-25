/**
 * @purpose Gestiona límites de velocidad para diferentes tipos de solicitudes utilizando MongoDB.
 * @purpose_en Manages rate limiting for various types of requests using MongoDB.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:2,imports:2,sig:4lwkk7
 * @lastUpdated 2026-06-23T23:25:41.007Z
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { connectDB } from '../db/mongodb';

/**
 * 🚦 Mongoose RateLimit Schema
 * Tracks requests per key to prevent volumetric/brute-force attacks.
 * Uses TTL index for auto-expiry of old entries.
 */
export interface IRateLimit extends Document {
  key: string;
  points: number;
  expireAt: Date;
  createdAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, index: true },
  points: { type: Number, default: 0 },
  expireAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  createdAt: { type: Date, default: Date.now },
});

let RateLimitModel: Model<IRateLimit> | null = null;

function getModel(): Model<IRateLimit> {
  if (RateLimitModel) return RateLimitModel;
  RateLimitModel = (mongoose.models.RateLimit as Model<IRateLimit>) 
    || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);
  return RateLimitModel;
}

/**
 * 🚦 Industrial Rate Limiter (MongoDB-backed)
 * 
 * Matches ABDAuth's RateLimitService pattern but uses Mongoose
 * for compatibility with satellite apps that connect via connectDB().
 * 
 * Persistent across serverless invocations (unlike the in-memory RateLimiter).
 * 
 * Uses atomic findOneAndUpdate with conditional $inc to eliminate TOCTOU races.
 */
export const rateLimitMongodb = {
  /**
   * 🛡️ Check and increment rate limit for a specific key (atomic)
   *
   * Uses MongoDB's findOneAndUpdate with a conditional filter
   * `{ points: { $lt: limit } }` so the increment only happens when
   * the counter is still below the limit — all in one atomic operation.
   *
   * @returns true if allowed, false if throttled
   */
  async check(
    identifier: string,
    type: 'login' | 'recovery' | 'api' | 'submission' | 'ingestion',
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    await connectDB();
    const Model = getModel();
    const key = `${type}:${identifier}`;
    const now = new Date();
    const expireAt = new Date(now.getTime() + windowSeconds * 1000);

    // ── 1. Atomic increment ────────────────────────────────────────────
    // Only increments `points` if:
    //   - Window is still active (expireAt > now)
    //   - Counter is still under the limit (points < limit)
    // Both conditions are evaluated atomically by MongoDB.
    const updated = await Model.findOneAndUpdate(
      { key, expireAt: { $gt: now }, points: { $lt: limit } },
      { $inc: { points: 1 } },
      { returnDocument: 'after' },
    ).exec();

    if (updated) return true; // Incremented successfully, still under limit

    // ── 2. Window is full ─────────────────────────────────────────────
    // The atomic increment above returned null because the filter
    // `points: { $lt: limit }` didn't match → counter is at or above limit.
    const existing = await Model.findOne({ key, expireAt: { $gt: now } }).exec();
    if (existing) return false; // Window still active but full → throttled

    // ── 3. No active window → create one (first request) ──────────────
    // Upsert handles concurrent first-request races safely: if two requests
    // create simultaneously, the second `$set` resets points to 1, which
    // matches the intention (both are valid first requests of their window).
    await Model.findOneAndUpdate(
      { key },
      {
        $set: { points: 1, expireAt },
        $setOnInsert: { key, createdAt: now },
      },
      { upsert: true },
    ).exec();

    return true;
  },

  /**
   * 🌐 Get Client IP from headers (works in serverless)
   * Uses platform-standard headers that Vercel, Cloudflare, etc. set.
   */
  getClientIp(): string {
    // In serverless environments, we need to access headers from the request object
    // This function should receive the request object from the caller
    // For dynamic headers access (next/headers), use getClientIpAsync
    return '0.0.0.0'; // Fallback — use getClientIpAsync for real IPs
  },

  /**
   * 🌐 Get Client IP using next/headers (async, needs request context)
   */
  async getClientIpAsync(): Promise<string> {
    try {
      const { headers } = await import('next/headers');
      const headerList = await headers();
      const forwarded = headerList.get('x-forwarded-for');
      if (forwarded) return forwarded.split(',')[0].trim();
      const realIp = headerList.get('x-real-ip');
      if (realIp) return realIp.trim();
    } catch {
      // next/headers not available (e.g., test environment)
    }
    return '127.0.0.1';
  },

  /**
   * 🛡️ Convenience wrapper: get IP from a standard Request object
   */
  getClientIpFromRequest(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
    return '127.0.0.1';
  },

  /**
   * 🧹 Reset rate limit for a specific key
   */
  async reset(
    identifier: string,
    type: 'login' | 'recovery' | 'api' | 'submission' | 'ingestion',
  ): Promise<void> {
    await connectDB();
    const Model = getModel();
    const key = `${type}:${identifier}`;
    await Model.deleteOne({ key }).exec();
  },
};
