/**
 * @module Player
 * @description
 * This module keeps track of the player's state.
 */
let Player = {};

/**
 * @name Player.target
 * @type {object}
 * @description
 * Keeps track of where the mouse is.
 */
Player.target = { x, y };

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

