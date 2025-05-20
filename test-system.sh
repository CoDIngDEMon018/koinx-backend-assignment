#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 Starting KoinX Crypto Stats System Test"

# Check if MongoDB is running
echo "📦 Checking MongoDB..."
if ! mongosh --eval "db.version()" > /dev/null 2>&1; then
    echo -e "${RED}❌ MongoDB is not running. Please start MongoDB first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ MongoDB is running${NC}"

# Check if NATS is running
echo "📦 Checking NATS..."
if ! nats-server -v > /dev/null 2>&1; then
    echo -e "${RED}❌ NATS is not running. Please start NATS first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ NATS is running${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
cd api-server && npm install
cd ../worker-server && npm install
cd ..

# Start the API server
echo "🚀 Starting API server..."
cd api-server
npm run dev &
API_PID=$!
cd ..

# Wait for API server to start
echo "⏳ Waiting for API server to start..."
sleep 5

# Test API endpoints
echo "🧪 Testing API endpoints..."

# Test /health endpoint
echo "Testing /health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo $HEALTH_RESPONSE
fi

# Test /stats endpoint
echo "Testing /stats endpoint..."
STATS_RESPONSE=$(curl -s "http://localhost:3000/api/stats?coin=bitcoin")
if [[ $STATS_RESPONSE == *"price"* ]]; then
    echo -e "${GREEN}✅ Stats endpoint working${NC}"
else
    echo -e "${RED}❌ Stats endpoint failed${NC}"
    echo $STATS_RESPONSE
fi

# Test /deviation endpoint
echo "Testing /deviation endpoint..."
DEVIATION_RESPONSE=$(curl -s "http://localhost:3000/api/deviation?coin=bitcoin")
if [[ $DEVIATION_RESPONSE == *"deviation"* ]]; then
    echo -e "${GREEN}✅ Deviation endpoint working${NC}"
else
    echo -e "${RED}❌ Deviation endpoint failed${NC}"
    echo $DEVIATION_RESPONSE
fi

# Start the worker server
echo "🚀 Starting worker server..."
cd worker-server
npm run dev &
WORKER_PID=$!
cd ..

# Wait for worker to process first batch
echo "⏳ Waiting for worker to process first batch..."
sleep 20

# Check MongoDB for stored data
echo "📊 Checking MongoDB for stored data..."
MONGO_DATA=$(mongosh koinx --eval "db.cryptostats.find().limit(1).toArray()" --quiet)
if [[ $MONGO_DATA == *"bitcoin"* ]]; then
    echo -e "${GREEN}✅ Data successfully stored in MongoDB${NC}"
else
    echo -e "${RED}❌ No data found in MongoDB${NC}"
fi

# Check metrics
echo "📈 Checking metrics..."
METRICS_RESPONSE=$(curl -s http://localhost:3000/metrics)
if [[ $METRICS_RESPONSE == *"http_request_duration_seconds"* ]]; then
    echo -e "${GREEN}✅ Metrics endpoint working${NC}"
else
    echo -e "${RED}❌ Metrics endpoint failed${NC}"
fi

# Cleanup
echo "🧹 Cleaning up..."
kill $API_PID
kill $WORKER_PID

echo "✨ Test completed!" 