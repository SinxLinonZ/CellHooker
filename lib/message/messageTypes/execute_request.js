const Log = require('../../logging.js');

function _handle(data) {

    // check username
    if (!data.header.username) {
        if (global.GLB_SESSION_CACHE[data.header.session]) {
            data.header.username = global.GLB_SESSION_CACHE[data.header.session].username;
        }
    }

    console.log(data);

}

module.exports = {
    type: 'execute_request',
    exec: function(data) {
        Log.Msg(`[ ${data.header.msg_type} ] received`);
        _handle(data);
        Log.Success(`[ ${data.header.msg_type} ] handled`);
    },
};