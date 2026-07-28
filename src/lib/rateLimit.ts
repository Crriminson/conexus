type RateLimitRecord = {
  count: number;
  resetAt: number;
};

// In-memory store for rate limits (Note: this resets on server restarts and isn't shared across edge nodes)
const rateLimitCache = new Map<string, RateLimitRecord>();

/**
 * A simple, in-memory IP rate limiter.
 * @param ip The IP address (or identifier) of the client.
 * @param maxRequests Maximum number of requests allowed in the time window.
 * @param windowMs The time window in milliseconds.
 * @returns { success: boolean, limit: number, remaining: number, reset: number }
 */
export function rateLimit(ip: string, maxRequests: number = 10, windowMs: number = 60000) {
  const now = Date.now();
  const record = rateLimitCache.get(ip);

  // If there's no record, or the window has passed, create a new one
  if (!record || record.resetAt < now) {
    rateLimitCache.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: now + windowMs,
    };
  }

  // If within the window, check if limit exceeded
  if (record.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: record.resetAt,
    };
  }

  // Increment count
  record.count += 1;
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.count,
    reset: record.resetAt,
  };
}
