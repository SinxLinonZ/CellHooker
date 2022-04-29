const red = '\u001b[31m';
const green = '\u001b[32m';
const yellow = '\u001b[33m';
const white = '\u001b[37m';
const blue = '\u001b[34m';
const reset = '\u001b[0m';

const _level = {
    Info: 0,
    Msg: 1,
    Success: 2,
    Warn: 3,
    Err: 4,
};
const LogLevel = _level[process.env.LOG_LEVEL]
    ? _level[process.env.LOG_LEVEL]
    : _level.Info;

module.exports = {
    Info: (str) => {
        if (_level.Info < LogLevel) return;
        console.log(white + 'INFO\t| ' + str + reset);
    },

    Warn: (str) => {
        if (_level.Warn < LogLevel) return;
        console.log(yellow + 'WARN\t| ' + str + reset);
    },

    Success: (str) => {
        if (_level.Success < LogLevel) return;
        console.log(green + 'SUCCESS\t| ' + str + reset);
    },

    Err: (str) => {
        if (_level.Err < LogLevel) return;
        console.log(red + 'ERR\t| ' + str + reset);
    },

    Msg: (str) => {
        if (_level.Msg < LogLevel) return;
        console.log(blue + 'Msg\t| ' + str + reset);
    },
};
