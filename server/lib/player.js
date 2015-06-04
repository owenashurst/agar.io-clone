// Player Entity

/**
 *  Representation of a player object with properties and methods
 *  @constructor
*/
function Player(cfg) {
    'use strict';

    cfg = cfg || {};

    // initialize a pseudo-random ID for the player entity
    this.id = cfg.id || Math.random() * 100000;

    // player attributes
    this.speed = cfg.speed || 0;
    this.mass = cfg.mass || 0;
    this.hue = cfg.hue || 0;
    this.name = cfg.name || '';

    // player position
    this.x = cfg.x || 0;
    this.y = cfg.y || 0;

    // server info
    this.socketId = cfg.socketId || '';
}


/**
 * Returns the id and hue of the player for welcome message
*/
Player.prototype.getSettings = function () {
    return { id : this.id, hue : this.hue };
};


/*
 * Moves the player in the direction of the target
 * TODO : Do not pass in defaultPlayerSize on every call
 */
Player.prototype.move = function (target, defaultPlayerSize) {
    'use strict';

    console.log('Moving player to :', target);

    return;
    /*
    var player = this;

    var dist = Math.sqrt(Math.pow(target.y - player.screenHeight / 2, 2) + Math.pow(target.x - player.screenWidth / 2, 2)),
        deg = Math.atan2(target.y - player.screenHeight / 2, target.x - player.screenWidth / 2);

    // Slow player as mass increases.
    var slowDown = ((player.mass + 1) / 17) + 1;

    var deltaY = player.speed * Math.sin(deg) / slowDown;
    var deltaX = player.speed * Math.cos(deg) / slowDown;

    if (dist < (100 + defaultPlayerSize + player.mass)) {
        deltaY *= dist / (100 + defaultPlayerSize + player.mass);
        deltaX *= dist / (100 + defaultPlayerSize + player.mass);
    }

    var borderCalc = defaultPlayerSize + player.mass - 15;

    player.y += (player.y + deltaY >= borderCalc && player.y + deltaY <= player.gameHeight - borderCalc) ? deltaY : 0;
    player.x += (player.x + deltaX >= borderCalc && player.x + deltaX <= player.gameWidth - borderCalc) ? deltaX : 0;
    */
};


/**
 * TODO
 * Serializes the Player object into a typed array for WebSocket compression
 */
Player.prototype.serialize = function () {
    var serial = new Float32Array(8);
    serial[0] = this.id;
    serial[1] = this.x;
    serial[2] = this.y;
    serial[3] = this.speed;
    serial[4] = this.mass;
    return serial;
};

module.exports = Player;
