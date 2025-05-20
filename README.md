# KoinX Crypto Stats System

A real-time cryptocurrency statistics system that tracks price deviations and provides historical data analysis.

## Features

- Real-time cryptocurrency price tracking
- Price deviation calculations
- Historical data storage and analysis
- Event-driven architecture using NATS
- Prometheus metrics and health checks
- Swagger API documentation
- Rate limiting and security features

## Prerequisites

- Node.js 16.x or higher
- MongoDB 4.x or higher
- NATS Server
- CoinGecko API key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd crypto-stats-system
```

2. Install dependencies for both servers:
```bash
# Install API server dependencies
cd api-server
npm install

# Install worker server dependencies
cd ../worker-server
npm install
```

3. Configure environment variables:

Create `.env` files in both `api-server` and `worker-server` directories with the following variables:

For `api-server/.env`:
```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/koinx
NATS_URL=nats://localhost:4222
LOG_LEVEL=info
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
COINGECKO_API_KEY=your_api_key_here
ENABLE_SWAGGER=true
```

For `worker-server/.env`:
```
NODE_ENV=development
NATS_URL=nats://localhost:4222
LOG_LEVEL=info
CRON_SCHEDULE="*/15 * * * *"
COINGECKO_API_KEY=your_api_key_here
```

## Running the System

1. Start MongoDB:
```bash
mongod
```

2. Start NATS server:
```bash
nats-server
```

3. Start the API server:
```bash
cd api-server
npm run dev
```

4. Start the worker server:
```bash
cd worker-server
npm run dev
```

## Testing the System

Run the automated test script:
```bash
chmod +x test-system.sh
./test-system.sh
```

This script will:
- Check if MongoDB and NATS are running
- Install dependencies
- Start both servers
- Test all API endpoints
- Verify data storage
- Check metrics
- Clean up processes

## API Documentation

Once the API server is running, you can access the Swagger documentation at:
```
http://localhost:3000/api-docs
```

## Available Endpoints

- `GET /health` - Health check endpoint
- `GET /ready` - Readiness check endpoint
- `GET /metrics` - Prometheus metrics endpoint
- `GET /api/stats?coin=<coin_id>` - Get latest stats for a cryptocurrency
- `GET /api/deviation?coin=<coin_id>` - Get price deviation for a cryptocurrency

## Monitoring

The system exposes Prometheus metrics at `/metrics` endpoint. You can use these metrics to:
- Monitor API performance
- Track database operations
- Monitor NATS message processing
- Track error rates

## Development

### Running Tests
```bash
# Run API server tests
cd api-server
npm test

# Run worker server tests
cd ../worker-server
npm test
```

### Code Quality
```bash
# Run linting
npm run lint

# Run type checking
npm run type-check
```

## Architecture

The system consists of two main components:

1. **API Server**
   - Handles HTTP requests
   - Provides REST API endpoints
   - Manages database operations
   - Exposes metrics and health checks

2. **Worker Server**
   - Runs background jobs
   - Fetches data from CoinGecko API
   - Publishes events to NATS
   - Handles data processing

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License. 