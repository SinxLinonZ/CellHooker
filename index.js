// self libs
const { WSUnmask } = require('./lib/wsBufferReader.js');
const Log = require('./lib/logging.js');
const MSGHandler = require('./lib/message/messageHandler.js');

// libs
const path = require('path');

// express initialization
const express = require('express');
const app = express();
app.use(express.json());
const EXPRESS_PORT = 3000;

// Global [session <=> username] cache
global.GLB_SESSION_CACHE = {};

// Database initialization
const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017';
const dbName = 'test_msg';
const client = new MongoClient(url);
let db;


/**
 * routes
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/data', async (req, res) => {
    // SELECT DATA FROM data
    const data = await db.collection('originData').find({}).toArray();
    res.send(data);
});

app.post('/data', (req, res) => {
    const recvData = req.body;

    // Get the data from the request
    const dataSide = recvData.side;
    const dataType = recvData.data.type;
    const dataRaw = recvData.data.data;

    // Convert Raw data to readable message list
    const bufferData = Buffer.from(dataRaw);
    const msgList = WSUnmask(bufferData);

    // Ignore heartbeat data
    if (msgList.length == 0) return;
    MSGHandler.HandleMessage(msgList);

    Log.Msg(`Received ${msgList.length} ${dataType} messages from ${dataSide}`);
    res.send('ok');
    return;
});


// Entry point
(async () => {
    try {
        // Connect to the database
        Log.Info('Application started.');
        Log.Info('Waiting for database connection...');

        await client.connect();
        db = client.db(dbName);
        Log.Success('Database connected.');

        // Initialize the message handler
        Log.Info('Initializing message handler...');
        MSGHandler.Init(db);
        Log.Success('Message handler initialized.');
    }

    catch (error) { Log.Err(error); }
    finally {
        app.listen(EXPRESS_PORT, () => {
            Log.Info(`Application listening on port ${EXPRESS_PORT}`);
        });
    }
})();