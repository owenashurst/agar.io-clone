let Events = require('./events'),
    Chat = require('./chat'),
    Render = require('./chat'),
    Player = require('./player'),
    System = require('./system'),
    Polyfill = require('./polyfill');

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

  // toggle DOM visibility
  Game.DOM.gameArea.style.display = 'block';
  Game.DOM.startMenu.style.display = 'none';

  // Listen for mouse actions
  let canvas = Render.__canvas__;
  canvas.addEventListener('mousemove', Game.setTargetFromEvent, false);
  canvas.addEventListener('mouseout', Game.targetOutOfBounds, false);

  Game.loop();
};

/**
 * @name Game.setTargetFromEvent
 * @param {Event} event
 * @description
 * Pass this as a callback to a mousemove event. It will update the
 * player's target based on the position of the event.
 */
Game.setTargetFromEvent = function(event) {
  Player.target = {
    x: event.clientX,
    y: event.clentY
  };
};

Game.targetOutOfBounds = function() {
  // figure this out later
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

  Render.drawPlayer(Player.entity);

  Events.emit.sendTarget(Player.target);
};

export default Game;

