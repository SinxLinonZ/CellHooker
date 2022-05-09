const Log = require('../../logging.js');

function _handle(db, data) {

    db.collection('executions').findOneAndUpdate(
        { msgId: data.parent_header.msg_id },
        { $set: {
            date: new Date(),
            result: data.content.status,
            STDtraceback: data.content.traceback || '',
            errName: data.content.ename || '',
            errValue: data.content.evalue || '',
        } },
        { upsert: true })

        .then(() => {
            return db.collection('executions').find({
                msgId: data.parent_header.msg_id,
            }).toArray();
        })
        .then(result => {
            result = result[0];

            const uuid = result.uuid;
            if (!global.subscription[uuid]) return;

            // send data to subscribers if cell uuid is matched
            for (const socket of global.subscription[uuid]) {
                socket.send(JSON.stringify(result));
            }
        });
}

module.exports = {
    type: 'execute_reply',
    exec: function(db, data) {
        Log.Msg(`[ ${data.header.msg_type} ] received`);
        _handle(db, data);
        Log.Success(`[ ${data.header.msg_type} ] handled`);
    },
};