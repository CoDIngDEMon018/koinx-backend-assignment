import { env } from 'process';
import { createHash, randomBytes } from 'crypto';

// Generate nonce for CSP
const generateNonce = () => {
  return createHash('sha256')
    .update(randomBytes(16).toString('hex'))
    .digest('base64');
};

export const SECURITY_CONFIG = Object.freeze({
  // Content Security Policy
  CSP: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'nonce-${nonce}'",  // Dynamically injected nonce
        env.NODE_ENV === 'development' ? "'unsafe-eval'" : "",  // Dev-only
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*.coingecko.com"],
      connectSrc: [
        "'self'", 
        env.NATS_URL,
        env.COINGECKO_API_BASE
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      reportUri: "/api/security/csp-report"
    },
    reportOnly: env.CSP_REPORT_ONLY === 'true'
  },

  // HTTP Headers
  HEADERS: {
    hsts: {
      maxAge: parseInt(env.HELMET_HSTS_MAX_AGE) || 63072000,  // 2 years
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    expectCt: {
      maxAge: 86400,
      enforce: true,
      reportUri: '/api/security/ct-report'
    }
  },

  // Rate Limiting
  RATE_LIMITS: {
    api: {
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(env.RATE_LIMIT_MAX_REQUESTS) || 100,
      standardHeaders: true,
      legacyHeaders: false
    },
    auth: {
      windowMs: 60 * 60 * 1000,  // 1 hour
      max: 10  // Login attempts
    }
  },

  // CORS Configuration
  CORS: {
    origin: env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'https://your-frontend.com'
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 600,
    credentials: true
  },

  // Request Validation
  REQUEST: {
    maxBodySize: env.REQUEST_SIZE_LIMIT || '10kb',
    maxFiles: 0  // Disable file uploads
  },

  // Security Middleware
  MIDDLEWARE: {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: (req, res) => ({
        ...SECURITY_CONFIG.CSP.directives,
        nonce: generateNonce()  // Dynamic nonce per request
      })
    }
  }
});

// Security headers to remove
export const REMOVE_HEADERS = [
  'X-Powered-By',
  'Server',
  'X-AspNet-Version'
];

// Security event reporting endpoints
export const SECURITY_REPORTING = {
  csp: '/api/security/csp-report',
  expectCt: '/api/security/ct-report',
  rateLimit: '/api/security/rate-limit-report'
};

/**
 * Security initialization middleware
 */
export const securityMiddleware = (app) => {
  // Generate initial nonce
  app.locals.nonce = generateNonce();

  // Rotate nonce every 15 minutes
  setInterval(() => {
    app.locals.nonce = generateNonce();
  }, 15 * 60 * 1000);
};