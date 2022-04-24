const fs = require('fs');
const Log = require('../logging.js');

let _db;
const _handle = {};

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

    HandleMessage: function(msgList) {
        msgList.forEach(stringData => {
            // ignore empty msg
            if (stringData == '' || stringData == null) return;

            // Parse msg into JSON
            let objData;
            try {
                objData = JSON.parse(stringData);
            }
            // drop data if is not valid JSON
            catch (error) {return;}

            // drop if isn't notebook msg
            // TODO: collect terminal msg
            if (!objData.header) {
                Log.Msg('Dropped non notebook message');
                return;
            }

            // drop if msg type/msg channel is ignored
            const msgType = objData.header.msg_type;
            if (process.env.IGNORE_MSGTYPE.includes(msgType)) {
                Log.Msg(`Msg type [ ${msgType} ] ignored`);
                return;
            }
            const msgChannel = objData.channel;
            if (process.env.IGNORE_CHANNEL.includes(msgChannel)) {
                Log.Msg(`Msg channel [ ${msgChannel} ] ignored`);
                return;
            }


            // store origin data as backup
            _db.collection('originData').findOneAndUpdate(
                { msgId: objData.header.msg_id },
                { $set: {
                    msgId: objData.header.msg_id,
                    originData: stringData,
                } },
                { upsert: true });

            // // check cell tag
            // // send data to subscribers if cell tag is matched
            // const tags = objData.metadata.tags || [];
            // if (tags.length > 0) {
            //     for (const tag of tags) {
            //         if (!global.subscription[tag]) continue;

            //         for (const socket of global.subscription[tag]) {
            //             socket.send(stringData);
            //         }
            //     }
            // }

            // Arrange different message types separately
            if (!_handle[msgType]) {
                Log.Err(`Unknown message type: ${msgType}`);
                return;
            }
            _handle[msgType](_db, objData);
        });
    },
};
