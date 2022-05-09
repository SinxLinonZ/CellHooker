const Log = require('../../logging.js');

function _handle(db, data) {

    db.collection('executions').findOneAndUpdate(
        { msgId: data.header.msg_id },
        { $set: {
            msgId: data.header.msg_id,
            username: data.header.username,
            uuid: data.metadata.RTL_UUID,
            code: data.content.code,

            // input: [],

            output: {
                order: [],
                stdout: [],
                'text/plain': [],
                'image/png': [],
            },
        } },
        { upsert: true });

}

module.exports = {
    type: 'execute_request',
    exec: function(db, data) {
        Log.Msg(`[ ${data.header.msg_type} ] received`);
        _handle(db, data);
        Log.Success(`[ ${data.header.msg_type} ] handled`);
    },
};