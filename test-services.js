const { connect } = require('nats');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

async function testServices() {
    console.log('🔍 Testing service connections...');

    // Test NATS connection
    try {
        console.log('\n📡 Testing NATS connection...');
        const nats = await connect('nats://localhost:4222');
        console.log('✅ NATS connection successful');
        
        // Test publishing a message
        const sub = nats.subscribe('test');
        nats.publish('test', 'Hello from test script');
        
        // Wait for message
        for await (const msg of sub) {
            console.log('✅ NATS message received:', msg.data.toString());
            break;
        }
        
        await nats.close();
    } catch (error) {
        console.error('❌ NATS connection failed:', error.message);
    }

    // Test MongoDB connection
    try {
        console.log('\n📦 Testing MongoDB connection...');
        const client = new MongoClient('mongodb://localhost:27017');
        await client.connect();
        console.log('✅ MongoDB connection successful');

        // Test database operations
        const db = client.db('koinx');
        const collection = db.collection('test');
        
        // Insert a test document
        await collection.insertOne({ test: 'Hello from test script' });
        console.log('✅ MongoDB write successful');

        // Read the test document
        const result = await collection.findOne({ test: 'Hello from test script' });
        console.log('✅ MongoDB read successful:', result);

        // Clean up
        await collection.deleteOne({ test: 'Hello from test script' });
        await client.close();
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }
}

testServices().catch(console.error); 