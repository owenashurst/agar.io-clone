let Events = require('./events'),
    Chat = require('./chat'),
    Render = require('./chat'),
    Player = require('./player'),
    System = require('./system'),
    Polyfill = require('./polyfill');

let Game = {};

Game.DOM = {};

Game.entities = {
  food: [],
  enemies: []
};

Game.start = function() {
  // get players name
  Player.name = Game.DOM.nameInput.value.replace(/(<([^>]+)>)/ig, '');

  // toggle DOM visibility
  Game.loop();
};

Game.init = function() {
  Game.DOM.startButton = document.getElementById('startButton');
  Game.DOM.nameInput = document.getElementById('playerNameInput');

  Game.DOM.startButton.addEventListener('click', Game.start);
  Game.DOM.nameInput.addEventListener('keypress', e => {
    if((e.which || e.keyCode) === 13) Game.start();
  });
};

Game.loop = function() {
  Polyfill.requestAnimationFrame(Game.loop);

  if(!System.status.connected) return Render.disconnected();
  if(!System.status.started) return Render.gameOver();

  Render.clearRect();
  Render.drawGrid();

  Game.entities.food.forEach(function(food) {
    Render.drawFood(food);
  });

  Game.entities.enemies.forEach(function(enemy) {
    Render.drawEnemy(enemy);
  });

  // draw player

  Events.emit.sendTarget();
};

export default Game;

