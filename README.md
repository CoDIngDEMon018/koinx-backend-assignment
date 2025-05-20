# Crypto Stats System

A system for collecting and exposing cryptocurrency statistics using Node.js, MongoDB, and NATS.

## System Architecture

The system consists of two servers:

1. **API Server**: Exposes REST endpoints for accessing cryptocurrency statistics and subscribes to NATS events to update the data.
2. **Worker Server**: Runs a background job every 15 minutes to trigger data updates via NATS.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- NATS server

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd crypto-stats-system
```

2. Install dependencies for both servers:
```bash
cd api-server && npm install
cd ../worker-server && npm install
```

3. Create a `.env` file in both `api-server` and `worker-server` directories with the following variables:
```env
# api-server/.env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/crypto-stats
NATS_URL=nats://localhost:4222

# worker-server/.env
NATS_URL=nats://localhost:4222
```

4. Start the servers:
```bash
# Terminal 1 - API Server
cd api-server
npm start

# Terminal 2 - Worker Server
cd worker-server
npm start
```

## API Endpoints

### Get Latest Stats
```
GET /api/stats?coin=<coin_id>
```
Returns the latest statistics for the specified cryptocurrency.

Query Parameters:
- `coin`: One of `bitcoin`, `ethereum`, or `matic-network`

Response:
```json
{
  "price": 40000,
  "marketCap": 800000000,
  "24hChange": 3.4
}
```

### Get Price Deviation
```
GET /api/deviation?coin=<coin_id>
```
Returns the standard deviation of the price for the last 100 records.

Query Parameters:
- `coin`: One of `bitcoin`, `ethereum`, or `matic-network`

Response:
```json
{
  "deviation": 4082.48
}
```

## Development

The project uses:
- Express.js for the API server
- MongoDB for data storage
- NATS for event messaging
- Winston for logging
- Node-cron for scheduling

## Monitoring

The API server includes Prometheus metrics at `/metrics` endpoint for monitoring:
- HTTP request duration
- Request counts
- Error rates
- Request sizes
- Response sizes

## License

ISC 