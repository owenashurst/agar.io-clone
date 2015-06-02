import Events from './events';
import Chat from './chat';
import Render from './render';
import Player from './player';
import System from './system';
import Polyfill from './polyfill';

let Game = {};

Game.DOM = {};

/**
 * @name Game.entitites
 * @description
 * Things that will be rendered.
 */
Game.entities = {
  food: [],
  enemies: []
};

/**
 * @name Game.start
 * @description
 * Function to be called when the player is ready to start.
 */
Game.start = function() {
  // get players name
  Player.name = Game.DOM.nameInput.value.replace(/(<([^>]+)>)/ig, '');

  // Listen for mouse actions
  let canvas = Render.__canvas__;
  canvas.addEventListener('mousemove', Game.setTargetFromEvent, false);
  canvas.addEventListener('mouseout', Game.targetOutOfBounds, false);

  // Add canvas to DOM
  Render.injectCanvas(Game.DOM.gameArea);

  // toggle DOM visibility
  Game.DOM.gameArea.style.display = 'block';
  Game.DOM.startMenu.style.display = 'none';

  Events.socket.emit('gotit', Player);
  Chat.addSystemLine('Connected to the game!');

  Game.loop();
};

/**
 * @name Game.init
 * @description
 * This should be called when the DOM is loaded. It attaches the
 * appropriate event listeners to DOM elements.
 */
Game.init = function() {
  Game.DOM = {
    startButton: document.getElementById('startButton'),
    nameInput:   document.getElementById('playerNameInput'),
    gameArea:    document.getElementById('gameAreaWrapper'),
    startMenu:   document.getElementById('startMenuWrapper')
  };

  Game.DOM.startButton.addEventListener('click', Game.start);
  Game.DOM.nameInput.addEventListener('keypress', e => {
    if((e.which || e.keyCode) === 13) Game.start();
  });

  Chat.bindElements();

  Events.onUpdate(function(entities) {
    for(let key in entities) {
      if(entities[key]) {
        Game.entities[key] = entities[key];
      }
    }
  });
};

/**
 * @name Game.loop
 * @description
 * The animation/update loop for the game. Will continuously call
 * itself using requestAnimationFrame.
 */
Game.loop = function() {
  Polyfill.requestAnimationFrame(Game.loop);

  if(!System.status.connected) return Render.disconnected();
  if(!System.status.started) return Render.gameOver();

  Render.clearRect();
  Render.drawGrid();

  // TODO don't render offscreen things
  Game.entities.food.forEach(function(food) {
    Render.drawFood(food);
  });

  // TODO don't render offscreen things
  Game.entities.enemies.forEach(function(enemy) {
    Render.drawEnemy(enemy);
  });

  Render.drawPlayer(Player);

  Events.emit.sendTarget(Player.target);
};

/**
 * @name Game.setTargetFromEvent
 * @param {Event} event
 * @description
 * Pass this as a callback to a mousemove event. It will update the
 * player's target based on the position of the event.
 */
Game.setTargetFromEvent = function(event) {
  Player.target.x = event.clientX;
  Player.target.y = event.clientY;
};

Game.targetOutOfBounds = function() {
  // figure this out later
};

export default Game;

