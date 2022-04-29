const fs = require('fs');
const Log = require('../logging.js');

let _db;
const _handle = {};

const _msgQueue = [];
const _debounceList = {};
let _queueRunning = false;


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

    Push: function(msgList) {
        for (const msg of msgList) {
            _msgQueue.push(msg);
        }

        if (_msgQueue.length > 0 && !_queueRunning) {
            _queueRunning = true;
            this._process();
        }
    },


    _handleMessage() {
        return new Promise((resolve) => {
            const stringData = _msgQueue.shift();
            if (!stringData) {
                _queueRunning = false;
                return resolve();
            }

            // Parse msg into JSON
            let objData;
            try {
                objData = JSON.parse(stringData);
            }
            // drop data if is not valid JSON
            catch (error) {return resolve();}

            // drop if isn't notebook msg
            // TODO: collect terminal msg
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

            // drop no tag msg if non tag is ignored
            // if (process.env.DROP_NONTAG) {
            //     const tags = objData.metadata.tags || [];
            //     if (tags.length == 0) {
            //         Log.Msg('Dropped non tagging message');
            //         return;
            //     }
            // }

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
                    originData: stringData,
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
        });
    },
    _process() {
        this._handleMessage().then(() => {
            if (_queueRunning) {
                this._process();
            }
        });
    },
};
