const Log = require('../../logging.js');

function _handle(data) {

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