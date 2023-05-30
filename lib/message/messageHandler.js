const fs = require('fs');
const Log = require('../logging.js');

let _db;
const _handle = {};
const _debounceList = {};

const Queue = {};

const WebSocket = {
    readFrame: function(buf) {
        if (buf.length < 2) return false;

        const frame = {
            FIN: undefined,
            opcode: undefined,
            masked: undefined,
            payloadLength: undefined,
            maskingKey: undefined,
            payloadData: undefined,

            isControlMsg: undefined,
            frameSize: undefined,
        };

        const byte0 = buf[0];
        const byte1 = buf[1];

        frame.FIN = byte0 >> 7 == 1;
        frame.opcode = byte0 & 0x0F;
        frame.isControlMsg = frame.opcode >= 0x8;
        frame.masked = byte1 >> 7 == 1;
        frame.payloadLength = byte1 & 0x7F;

        frame.frameSize = 2;
        if (frame.payloadLength == 126) {
            if (buf.length < 4) return false;
            frame.payloadLength = buf.readUInt16BE(frame.frameSize);
            frame.frameSize += 2;
        }
        else if (frame.payloadLength == 127) {
            if (buf.length < 10) return false;
            frame.payloadLength = buf.readUInt32BE(frame.frameSize) * Math.pow(2, 32) + buf.readUInt32BE(frame.frameSize + 4);
            frame.frameSize += 8;
        }
        if (frame.masked) {
            if (buf.length < frame.frameSize + 4) return false;
            frame.maskingKey = buf.slice(frame.frameSize, frame.frameSize + 4);
            frame.frameSize += 4;
        }

        if (buf.length < frame.frameSize + frame.payloadLength) return false;
        frame.payloadData = buf.slice(frame.frameSize, frame.frameSize + frame.payloadLength);

        frame.frameSize += frame.payloadLength;
        return frame;
    },
};


module.exports = {
    Init: function(db) {
        // Cache database connection
        _db = db;

        // Load all message handlers
        const files = fs
            .readdirSync(__dirname + '/messageTypes')
            .filter(file => file.endsWith('.js'));

        for (const file of files) {
            const handler = require(__dirname + `/messageTypes/${file}`);
            _handle[handler.type] = handler.exec;
        }
    },

    Push: function(data) {

        // const dataSide = data.side;
        const dataUUID = data.uuid;
        // const dataType = data.data.type;
        const dataRaw = data.data.data;

        if (Queue[dataUUID] == undefined) {
            Queue[dataUUID] = {
                _queue: Buffer.from([]),
                _queueRunning: false,
                _buff: [],

                push: function(_data) {
                    this._queue = Buffer.concat([this._queue, _data]);

                    if (this._queue.length > 0 && !this._queueRunning) {
                        this._queueRunning = true;
                        this._process();
                    }
                },

                _handleMessage: function() {
                    return new Promise((resolve) => {
                        if (this._queue.length == 0) {
                            this._queueRunning = false;
                            return resolve();
                        }

                        const frame = WebSocket.readFrame(this._queue);
                        // Frame is not complete
                        if (!frame) {
                            this._queueRunning = false;
                            return resolve();
                        }
                        this._queue = this._queue.slice(frame.frameSize);

                        // Ignore control messages
                        if (frame.isControlMsg) return resolve();


                        this._buff.push(frame);

                        // If is terminal frame
                        if (frame.FIN) {
                            // TODO: handle fragmented messages
                            const payLoadData = this._buff.map(item => item.payloadData).reduce((a, b) => Buffer.concat([a, b]));
                            const payLoadLength = this._buff.map(item => item.payloadLength).reduce((a, b) => a + b);

                            let buf = Buffer.alloc(payLoadLength);

                            if (!(this._buff[0].masked)) {
                                buf = payLoadData;
                            }
                            else {
                                for (let i = 0; i < payLoadLength; i++) {
                                    buf[i] = payLoadData[i] ^ this._buff[0].maskingKey[i % 4];
                                }
                            }

                            this._buff = [];

                            // Data Analysis
                            // console.log(buf.toString());
                            let objData;
                            try {
                                objData = JSON.parse(buf.toString());
                            }
                            // drop data if is not valid JSON
                            catch (error) {return resolve();}

                            if (!objData.header) {
                                Log.Msg('Dropped non notebook message');
                                return resolve();
                            }

                            // drop if msg type/msg channel is ignored
                            const msgType = objData.header.msg_type;
                            if (process.env.IGNORE_MSGTYPE.includes(msgType)) {
                                Log.Msg(`Msg type [ ${msgType} ] ignored`);
                                return resolve();
                            }
                            const msgChannel = objData.channel;
                            if (process.env.IGNORE_CHANNEL.includes(msgChannel)) {
                                Log.Msg(`Msg channel [ ${msgChannel} ] ignored`);
                                return resolve();
                            }

                            // message id debouncing
                            if (_debounceList[objData.header.msg_id]) {
                                Log.Warn('Dropped debounced message');
                                return resolve();
                            }
                            _debounceList[objData.header.msg_id] = true;
                            setTimeout(() => {
                                delete _debounceList[objData.header.msg_id];
                            }, process.env.DEBOUNCE_TIME || 2000);

                            // store origin data as backup
                            _db.collection('originData').findOneAndUpdate(
                                { msgId: objData.header.msg_id },
                                { $set: {
                                    msgId: objData.header.msg_id,
                                    originData: buf.toString(),
                                } },
                                { upsert: true }).then(() => {
                                // Arrange different message types separately
                                if (!_handle[msgType]) {
                                    Log.Err(`Unknown message type: ${msgType}`);
                                    return resolve();
                                }
                                _handle[msgType](_db, objData);
                                resolve();
                            });
                        }
                        else {
                            return resolve();
                        }
                    });
                },

                _process: function() {
                    this._handleMessage().then(() => {
                        if (this._queueRunning) this._process();
                    });
                },

            };


        }

        Queue[dataUUID].push(Buffer.from(dataRaw));
    },
};
