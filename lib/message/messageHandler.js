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

            // store origin data as backup
            _db.collection('originData').findOneAndUpdate(
                { msgId: objData.header.msg_id },
                { $set: {
                    msgId: objData.header.msg_id,
                    originData: stringData,
                } },
                { upsert: true });

            // Arrange different message types separately
            const msgType = objData.header.msg_type;

            if (!_handle[msgType]) {
                Log.Err(`Unknown message type: ${msgType}`);
                return;
            }
            _handle[msgType](objData);
        });
    },
};