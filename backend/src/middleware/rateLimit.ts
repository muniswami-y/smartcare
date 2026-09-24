import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitStore>();

export function rateLimit(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyPrefix?: string;
}) {
  const { windowMs, maxRequests, message = 'Too many requests. Please try again later.', keyPrefix = 'rl' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.socket.remoteAddress || 'anonymous';
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();

    let record = memoryStore.get(key);

    if (!record || now > record.resetAt) {
      record = {
        count: 1,
        resetAt: now + windowMs
      };
      memoryStore.set(key, record);
    } else {
      record.count++;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > maxRequests) {
      return next(new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'));
    }

    next();
  };
}

// Specialized rate limiters
export const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5,
  keyPrefix: 'otp',
  message: 'Maximum OTP request attempts exceeded. Please wait 5 minutes.'
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again later.'
});

export const apiWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 120,
  keyPrefix: 'write'
});
