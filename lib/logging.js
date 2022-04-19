const red = '\u001b[31m';
const green = '\u001b[32m';
const yellow = '\u001b[33m';
const white = '\u001b[37m';
const blue = '\u001b[34m';
const reset = '\u001b[0m';

module.exports = {
    Info: (str) => {
        console.log(white + 'INFO\t| ' + str + reset);
    },

    Warn: (str) => {
        console.log(yellow + 'WARN\t| ' + str + reset);
    },

    Success: (str) => {
        console.log(green + 'SUCCESS\t| ' + str + reset);
    },

    Err: (str) => {
        console.log(red + 'ERR\t| ' + str + reset);
    },

    Msg: (str) => {
        console.log(blue + 'Msg\t| ' + str + reset);
    },
};
