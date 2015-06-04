// Player Entity

/**
 *  Representation of a player object with properties and methods
 *  @constructor
*/
function Player(cfg) {
    'use strict';

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


/**
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
