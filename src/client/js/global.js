module.exports = {
    // Keys and other mathematical constants
    KEY_ESC: 27,
    KEY_ENTER: 13,
    KEY_CHAT: 13,
    KEY_FIREFOOD: 119,
    KEY_SPLIT: 32,
    KEY_LEFT: 37,
    KEY_UP: 38,
    KEY_RIGHT: 39,
    KEY_DOWN: 40,
    borderDraw: false,
    mobile: false,
    // Canvas
    screen: {
        width: window.innerWidth,
        height: window.innerHeight
    },
    game: {
        width: 0,
        height: 0
    },
    gameStart: false,
    disconnected: false,
    kicked: false,
    continuity: false,
    startPingTime: 0,
    toggleMassState: 0,
    backgroundColor: '#f2fbff',
    lineColor: '#000000',
};
