const Log = require('../../logging.js');

function _handle(db, data) {

    db.collection('executions').findOneAndUpdate(
        { msgId: data.parent_header.msg_id },
        { $set: {
            username: data.header.username,
        } },
        { upsert: true });

}

module.exports = {
    type: 'execute_input',
    exec: function(db, data) {
        Log.Msg(`[ ${data.header.msg_type} ] received`);
        _handle(db, data);
        Log.Success(`[ ${data.header.msg_type} ] handled`);
    },
};