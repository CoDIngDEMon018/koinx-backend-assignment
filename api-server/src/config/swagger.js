export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Crypto Stats API',
      version: '1.0.0',
      description: 'API for cryptocurrency statistics',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        CryptoStats: {
          type: 'object',
          properties: {
            price: {
              type: 'number',
              description: 'Current price in USD',
            },
            marketCap: {
              type: 'number',
              description: 'Market cap in USD',
            },
            '24hChange': {
              type: 'number',
              description: '24-hour price change percentage',
            },
          },
        },
        PriceDeviation: {
          type: 'object',
          properties: {
            deviation: {
              type: 'number',
              description: 'Standard deviation of price for last 100 records',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Error status',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
}; 