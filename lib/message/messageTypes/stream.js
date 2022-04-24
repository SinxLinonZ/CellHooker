const Log = require('../../logging.js');

function _handle(db, data) {

    // not stdout
    if (data.content.name != 'stdout') {
        Log.Err(`Output type [ ${data.content.name} ] not supported yet`);
        return;
    }

    db.collection('executions').findOneAndUpdate(
        { msgId: data.parent_header.msg_id },
        { $push: {
            'output.order': 'stdout',
            'output.stdout': data.content.text,
        } },
        { upsert: true });

}

module.exports = {
    type: 'stream',
    exec: function(db, data) {
        Log.Msg(`[ ${data.header.msg_type} ] received`);
        _handle(db, data);
        Log.Success(`[ ${data.header.msg_type} ] handled`);
    },
};