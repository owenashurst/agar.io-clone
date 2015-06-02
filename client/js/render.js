import Config from './config.json';
import System from './system';
import Player from './player';

/**
 * @module Render
 * @description
 * This is a stateless rendering module (with the exception of the
 * canvas it keeps track of). No stateful properties should be added
 * here and the methods should only be informed by their arguments.
 */
let Render = {};

/**
 * @name Render.bounds
 * @description
 * Keeps track of the current width and height of the canvas
 */
Render.bounds = {
  width: 0,
  height: 0
};

/**
 * @name Render.createContext
 * @return {CanvasRenderingContext2d}
 * @description
 * Creates and returns a new Context2d
 */
Render.createContext = function() {
  var canvas = document.createElement('canvas'),
      context = canvas.getContext('2d');

  Render.__canvas__ = canvas;
  return context;
};

/**
 * @name Render.createContext
 * @param {DOMElement} parent
 * @description
 * Appends the canvas to the element passed as parent. Then creates
 * an event listener which listens for resizes and updates the
 * canvas appropriately.
 */
Render.injectCanvas = function(parent) {
  Render.__parent__ = parent;
  window.addEventListener('resize', Render.resize);
  Render.resize();
  parent.appendChild(Render.__canvas__);
};

/**
 * @name Render.resize
 * @description
 * Resize the canvas to fill all of the available space with it's
 * parent element.
 */
Render.resize = function() {
  if(Render.__parent__ && Render.__canvas__) {
    let parent = Render.__parent__,
        canvas = Render.__canvas__;

    Render.bounds.width = canvas.width = window.innerWidth;
    Render.bounds.height = canvas.height = window.innerHeight;
    Player.gameWidth = Render.bounds.width * 3;
    Player.gameHeight = Render.bounds.height * 3;
    Player.offset.x = -Player.target.gameWidth;
    Player.offset.y = -Player.target.gameHeight;
  }
};

/**
 * @name Render.ctx
 * @type {RenderingContext2d}
 * @description
 * Expose the context for the other render methods.
 */
Render.ctx = Render.createContext();

/**
 * @name Render.drawCircle
 * @param {number} cx center coord x
 * @param {number} cy center coord y
 * @description
 * Uses parametric equation of a circle to draw a polygonal
 * circle with a fixed number of sides.
 */
Render.drawCircle = function(cx, cy, numberOfSides) {
  let [theta, x, y] = [0, 0, 0],
      radius = numberOfSides * 1.5;

  for(let i = 0; i < numberOfSides; i++) {
    theta = (i / numberOfSides) * 2 * Math.PI;
    x = cx + radius * Math.sin(theta);
    y = cy + radius * Math.cos(theta);
    Render.ctx.lineTo(x, y);
  }

  Render.ctx.closePath();
  Render.ctx.stroke();
  Render.ctx.fill();
};

/**
 * @name Render.drawFood
 * @param {Food} food
 * An instance of a food object
 * @description
 * Draws a piece of food.
 */
Render.drawFood = function(food) {
  Render.ctx.strokeStyle = food.color.border || Config.food.borderColor;
  Render.ctx.fillStyle = food.color.fill || Config.food.fillColor;
  Render.ctx.lineWidth = Config.food.border;

  let x = food.x - Player.x + (Render.bounds.width / 2),
      y = food.y - Player.y + (Render.bounds.height / 2);

  Render.drawCircle(x, y, Config.food.size);
};

/**
 * @name Render.drawEnemy
 * @param {Player} enemy
 * An instance of a enemy Player object
 * @description
 * Draws an enemy.
 */
Render.drawEnemy = function(enemy) {
  let x = enemy.x - Player.x + (Render.bounds.width / 2),
      y = enemy.y - Player.y + (Render.bounds.height / 2);

  Render.drawPlayer(enemy, x, y);
};

/**
 * @name Render.drawPlayer
 * @param {Player} player The instance of your Player object
 * @param {number} xOverride Allows overriding of Player x
 * @param {number} yOverride Allows overriding of Player y
 * @description
 * Draws your player.
 */
Render.drawPlayer = function(player, xOverride, yOverride) {
  let x = xOverride || Render.bounds.width / 2,
      y = yOverride || Render.bounds.height / 2,
      mass = Config.player.default_size + player.mass,
      fontSize = (player.mass / 2) + Config.player.default_size;

  Render.ctx.strokeStyle = `hsl(${player.hue}, 80%, 40%)`;
  Render.ctx.fillStyle = `hsl(${player.hue}, 70%, 50%)`;
  Render.ctx.lineWidth = Config.player.border;

  Render.ctx.beginPath();
  Render.ctx.arc(x, y, mass, 0, 2 * Math.PI);
  Render.ctx.stroke();
  Render.ctx.fill();

  Render.ctx.lineWidth = Config.player.text_border_size;
  Render.ctx.miterLimit = 1;
  Render.ctx.lineJoin = 'round';
  Render.ctx.textAlign = 'center';
  Render.ctx.fillStyle = Config.player.text_color;
  Render.ctx.textBaseline = 'middle';
  Render.ctx.strokeStyle = Config.player.text_border;
  Render.ctx.font = 'bold ' + fontSize + 'px sans-serif';
  Render.ctx.strokeText(player.name, x, y);
  Render.ctx.fillText(player.name, x, y);
};

/**
 * @name Render.clearRect
 * @description
 * Clears the canvas
 */
Render.clearRect = function() {
  Render.ctx.clearRect(0, 0, Render.bounds.width, Render.bounds.height);
};

/**
 * @name Render.drawGrid
 * @description
 * Draw the background grid on screen.
 */
Render.drawGrid = function() {
  Render.ctx.fillStyle = System.status.background;
  Render.ctx.fillRect(0, 0, Render.bounds.width, Render.bounds.height);

  for(let x = Player.offset.x; x < Render.bounds.width; x += Render.bounds.height / 20) {
    Render.ctx.moveTo(x, 0);
    Render.ctx.lineTo(x, Render.bounds.height);
  }

  for(let y = Player.offset.y; y < Render.bounds.height; y += Render.bounds.height / 20) {
    Render.ctx.moveTo(0, y);
    Render.ctx.lineTo(Render.bounds.width, y);
  }

  Render.ctx.strokeStyle = '#ddd';
  Render.ctx.stroke();
};

/**
 * @name Render.gameOver
 * @description
 * Draw the game over screen
 */
Render.gameOver = function() {
  Render.ctx.fillStyle = '#333333';
  Render.ctx.fillRect(0, 0, Render.bounds.width, Render.bounds.height);

  Render.ctx.textAlign = 'center';
  Render.ctx.fillStyle = '#FFFFFF';
  Render.ctx.font = 'bold 30px sans-serif';
  Render.ctx.fillText('Game Over!', Render.bounds.width / 2, Render.bounds.height / 2);
};

/**
 * @name Render.disconnected
 * @description
 * Draw the disconnected screen
 */
Render.disconnected = function() {
  Render.ctx.fillStyle = '#333333';
  Render.ctx.fillRect(0, 0, Render.bounds.width, Render.bounds.height);

  Render.ctx.textAlign = 'center';
  Render.ctx.fillStyle = '#FFFFFF';
  Render.ctx.font = 'bold 30px sans-serif';
  Render.ctx.fillText('Disconnected!', Render.bounds.width / 2, Render.bounds.height / 2);
};

export default Render;

