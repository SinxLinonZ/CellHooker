/**
 * Unmask single websocket message
 * @param {Buffer} buffer Buffer data
 * @returns {Object} {data: <unmasked data>, remain: <remaining buffer>}
 */
function WAReadPacket(buffer) {
    let pointer = 1;
    let length = buffer.readUInt8(pointer);
    pointer += 1;

    // no payload data
    if (length == 0) return { data: null, remain: buffer.slice(pointer) };


    // check is server msg or client msg
    let MASKED = false;
    if (length > 127) {
        length -= 128;
        MASKED = true;
    }

    // get payload length
    if (length == 126) {
        length = buffer.readUInt16BE(pointer);
        pointer += 2;
    }
    if (length == 127) {
        length = parseInt(buffer.readBigUInt64BE(pointer));
        pointer += 8;
        console.error('Big int: ' + length);
    }

    let DECODED = Buffer.alloc(length);
    let MASK;

    if (MASKED) {
        MASK = buffer.slice(pointer, pointer + 4);
        pointer += 4;
        for (let i = 0; i < length; i++) {
            DECODED[i] = buffer[pointer + i] ^ MASK[i % 4];
        }
    }
    else {
        for (let i = 0; i < length; i++) {
            DECODED[i] = buffer[pointer + i];
        }
    }

    pointer += length;
    DECODED = DECODED.length > 0 ? DECODED.toString() : null;

    // console.log('========================');
    // console.log(' DEBUG PACKAGE ');
    // console.log('========================');
    // console.log(DECODED);

    return { data: DECODED, remain: buffer.slice(pointer) };
}

module.exports = {
    /**
     * Unmask all websocket message into a list
     * @param {Buffer} data Buffer data
     * @returns {Array} unmasked data list
     */
    WSUnmask: function(data) {
        const res = [];
        let read = { remain: data };

        do {
            read = WAReadPacket(read.remain);
            if (read.data != null) res.push(read.data);
        } while (read.remain.length > 0);

        return res;
    },

};
