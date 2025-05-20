export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Crypto Stats API',
      version: '1.0.0',
      description: 'API for cryptocurrency statistics and price deviation calculations',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'API Server'
      }
    ],
    components: {
      schemas: {
        CryptoStats: {
          type: 'object',
          properties: {
            price: {
              type: 'number',
              description: 'Current price in USD',
              example: 40000
            },
            marketCap: {
              type: 'number',
              description: 'Market cap in USD',
              example: 800000000000
            },
            '24hChange': {
              type: 'number',
              description: '24-hour price change percentage',
              example: 2.5
            }
          }
        },
        PriceDeviation: {
          type: 'object',
          properties: {
            deviation: {
              type: 'number',
              description: 'Standard deviation of price for last 100 records',
              example: 1234.56
            },
            sampleSize: {
              type: 'number',
              description: 'Number of records used in calculation',
              example: 100
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Error status',
              example: 'error'
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Invalid coin parameter'
            }
          }
        }
      },
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    },
    security: [{
      ApiKeyAuth: []
    }]
  },
  apis: ['./src/routes/*.js']
};