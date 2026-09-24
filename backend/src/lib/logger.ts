import pino from 'pino';

// Masking patient PHI fields in all server logs
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'otp',
      'phone',
      'email',
      'abhaId',
      '*.phone',
      '*.email',
      '*.abhaId',
      '*.password'
    ],
    censor: '[REDACTED_PHI]'
  },
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});
