import { cleanEnv, str, port, url, bool } from 'envalid';

export const validateEnv = () => {
  cleanEnv(process.env, {
    NODE_ENV: str({ choices: ['development', 'test', 'production'] }),
    PORT: port({ default: 3000 }),
    MONGODB_URI: url(),
    NATS_URL: url(),
    LOG_LEVEL: str({ choices: ['error', 'warn', 'info', 'debug'], default: 'info' }),
    CORS_ORIGIN: str({ default: '*' }),
    RATE_LIMIT_WINDOW_MS: port({ default: 900000 }), // 15 minutes
    RATE_LIMIT_MAX: port({ default: 100 }),
    COINGECKO_API_KEY: str({ optional: true }),
    ENABLE_SWAGGER: bool({ default: false })
  });
}; 