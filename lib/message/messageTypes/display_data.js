const Log = require('../../logging.js');

function _handle(db, data) {

    db.collection('executions').findOneAndUpdate(
        { msgId: data.parent_header.msg_id },
        { $push: {
            'output.order': 'image/png',
            'output.image/png': {
                base64: data.content.data['image/png'],
                metadata: data.content.data.metadata,
                transient: data.content.data.transient,
            },
        } },
        { upsert: true });

}

module.exports = {
    type: 'display_data',
    exec: function(db, data) {
        Log.Msg(`[ ${data.header.msg_type} ] received`);
        _handle(db, data);
        Log.Success(`[ ${data.header.msg_type} ] handled`);
    },
};