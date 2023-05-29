// Get settings from .env
require('dotenv').config();

// Global variables
global.subscription = {};

// local libs
const { WSUnmask } = require('./lib/wsBufferReader.js');
const Log = require('./lib/logging.js');
const MSGHandler = require('./lib/message/messageHandler.js');

// libs
const express = require('express');
const ws = require('ws');
const cors = require('cors');

// express initialization
const app = express();
app.use(express.json({ limit: '10mb' }));

// Websocket server initialization
const wsServer = new ws.Server({ noServer: true });

// Database initialization
const { MongoClient } = require('mongodb');
const url = 'mongodb://127.0.0.1:27017';
const dbName = 'test_msg2';
const client = new MongoClient(url);
let db;


/**
 * Web socket server events
 */
wsServer.on('connection', socket => {

    console.log('New connection');

    socket.on('message', (message) => {
        console.log('Received message');

        message = JSON.parse(message);

        if (message.type == 'subscribe') {
            socket.subscription = true;

            for (const uuid of message.data.uuidList) {
                if (!global.subscription[uuid]) {
                    global.subscription[uuid] = [];
                }
                global.subscription[uuid].push(socket);
            }
        }
    });

    socket.on('error', (error) => {
        console.log('socket err: ', error);

        if (socket.subscription) {
            for (const uuid in global.subscription) {
                if (global.subscription[uuid].includes(socket)) {
                    global.subscription[uuid].splice(global.subscription[uuid].indexOf(socket), 1);
                }
            }
        }
    });

    socket.on('close', (code, reason) => {
        console.log('socket close: ', code, reason);

        if (socket.subscription) {
            for (const uuid in global.subscription) {
                if (global.subscription[uuid].includes(socket)) {
                    global.subscription[uuid].splice(global.subscription[uuid].indexOf(socket), 1);
                }
            }
        }
    });
});


app.use(cors({
    credentials: true,
    preflightContinue: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: true,
}));

/**
 * routes
 */
app.get('/data', async (req, res) => {
    const data = await db.collection('executions').find({}).toArray();
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
    if (msgList.length == 0) {
        res.send('ok');
        res.end();
        return;
    }
    MSGHandler.Push(msgList);

    Log.Msg(`Received ${msgList.length} ${dataType} messages from ${dataSide}`);
    res.send('ok');
    res.end();
});

app.post('/api/executions', async (req, res) => {
    const { username, uuidList } = req.body;

    const data = {};
    for await (const uuid of uuidList) {
        let cellData = await db.collection('executions')
            .find({ uuid: uuid }).toArray();
        if (username) {
            cellData = cellData.filter(item => item.username == username);
        }
        data[uuid] = cellData;
    }

    res.send(data);
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

        // Initialize ENV
        process.env.IGNORE_MSGTYPE = JSON.parse(process.env.IGNORE_MSGTYPE);
        process.env.IGNORE_CHANNEL = JSON.parse(process.env.IGNORE_CHANNEL);
    }

    catch (error) { Log.Err(error); }
    finally {
        const server = app.listen(process.env.PORT || 3000, () => {
            Log.Info(`Application listening on port ${process.env.PORT || 3000}`);
        });

        // Handle websocket connection
        server.on('upgrade', (request, socket, head) => {
            wsServer.handleUpgrade(request, socket, head, (_socket) => {
                wsServer.emit('connection', _socket, request);
            });
        });
    }
})();