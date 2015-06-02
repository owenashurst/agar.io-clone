/**
 * @module Player
 * @description
 * This module keeps track of the player's state.
 */
let Player = {};

/**
 * @name Player.target
 * @description
 * Keeps track of where the mouse is.
 */
Player.target = { x: 0, y: 0 };

/**
 * @name Player.offset
 * @description
 * Keeps track of player offset.
 */
Player.offset = { x: 0, y: 0 };

/**
 * @name Player.mass
 * @description
 * The size of the player.
 */
Player.mass = 0;

Player.x = 0;
Player.y = 0;
Player.speed = 5;

/**
 * @name Player.update
 * @param {object} data
 * @description
 * Applies all the properties within data
 * to this Player instance.
 */
Player.update = function(data) {
  for(let key in data) {
    Player[key] = data[key];
  }
};

export default Player;

