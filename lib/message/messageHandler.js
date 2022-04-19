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

            // Check msg username
            // TODO: drop if is ignored channel
            let username = objData.header.username;
            // if (username == '' && !DROP) {
            console.log(username);
            if (username == '') {
                username = 'Anonymous_' + objData.header.session;
            }
            console.log(username);

            // Cache session <=> username for 24 hours
            if (!global.GLB_SESSION_CACHE[objData.header.session]) {
                global.GLB_SESSION_CACHE[objData.header.session] = {
                    username: username,
                    isAnonumous: username.indexOf('Anonymous_') != -1,
                    expireTimer: setTimeout(() => {
                        delete global.GLB_SESSION_CACHE[objData.header.session];
                    }, 1000 * 60 * 60 * 24),
                };
            }
            else {
                // reset expire timer
                clearTimeout(global.GLB_SESSION_CACHE[objData.header.session].expireTimer);
                global.GLB_SESSION_CACHE[objData.header.session].expireTimer =
                    setTimeout(() => {
                        delete global.GLB_SESSION_CACHE[objData.header.session];
                    });

                // update username if needed
                if (global.GLB_SESSION_CACHE[objData.header.session].isAnonumous
                    && username.indexOf('Anonymous_') == -1) {
                    global.GLB_SESSION_CACHE[objData.header.session].isAnonumous = false;
                    global.GLB_SESSION_CACHE[objData.header.session].username = username;
                }
            }


            // store origin data as backup
            _db.collection('originData').findOneAndUpdate(
                { msgId: objData.header.msg_id },
                { $set: {
                    msgId: objData.header.msg_id,
                    username: username,
                    originData: stringData,
                } },
                { upsert: true });

            // Arrange different message types separately
            const msgType = objData.header.msg_type;

            if (!_handle[msgType]) {
                Log.Err(`Unknown message type: ${msgType}`);
                return;
            }
            objData.header.username = username;
            _handle[msgType](objData);
        });
    },
};