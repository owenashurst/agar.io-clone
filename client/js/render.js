let Config = require('./config.json');

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
  parent.appendChild(Render.__canvas__);
  parent.addEventListener('resize', Render.resize);
  Render.resize();
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

    Render.bounds.width = canvas.width = parent.offsetWidth;
    Render.bounds.height = canvas.height = parent.offsetHeight;
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
 * @param {number} cx
 * The x-coordinate center of the circle
 * @param {number} cy
 * The y-coordinate center of the circle
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
  Render.ctx.strokeStyle = food.color.border || config.food.borderColor;
  Render.ctx.fillStyle = food.color.fill || config.food.fillColor;
  Render.ctx.lineWidth = config.food.border;

  let x = food.x - player.x + (Render.bounds.width / 2),
      y = food.y - player.y + (Render.bounds.height / 2);

  drawCircle(x, y, config.food.size);
};

/**
 * @name Render.drawEnemy
 * @param {Player} enemy
 * An instance of a enemy player object
 * @description
 * Draws an enemy.
 */
Render.drawEnemy = function(enemy) {
  let x = enemy.x - player.x + (Render.bounds.width / 2),
      y = enemy.y - player.y + (Render.bounds.height / 2);

  Render.drawPlayer(enemy, x, y);
};

/**
 * @name Render.drawPlayer
 * @param {Player} player
 * The instance of your player object
 * @param {number} xOverride
 * Allows overriding of player x
 * @param {number} yOverride
 * Allows overriding of player y
 * @description
 * Draws your player.
 */
Render.drawPlayer = function(player, xOverride, yOverride) {
  let x = xOverride || Render.bounds.width / 2,
      y = yOverride || Render.bounds.height / 2,
      mass = config.player.defaultSize + player.mass,
      fontSize = (player.mass / 2) + config.player.defaultSize;

  Render.ctx.strokeStyle = `hsl(${player.hue}, 80%, 40%)`;
  Render.ctx.fillStyle = `hsl(${player.hue}, 70%, 50%)`;
  Render.ctx.lineWidth = config.player.border;

  Render.ctx.beginPath();
  Render.ctx.arc(x, y, mass, 0, 2 * Math.PI);
  Render.ctx.stroke();
  Render.ctx.fill();

  Render.ctx.lineWidth = config.player.textBorderSize;
  Render.ctx.miterLimit = 1;
  Render.ctx.lineJoin = 'round';
  Render.ctx.textAlign = 'center';
  Render.ctx.fillStyle = config.player.textColor;
  Render.ctx.textBaseline = 'middle';
  Render.ctx.strokeStyle = config.player.textBorder;
  Render.ctx.font = 'bold ' + fontSize + 'px sans-serif';
  Render.ctx.strokeText(player.name, x, y);
  Render.ctx.fillText(player.name, x, y);
};

/**
 * @name Render.drawGrid
 * @description
 * Draw the background grid on screen.
 */
Render.drawGrid = function() {
  for(let x = xoffset; x < Render.bounds.width; x += Render.bounds.height / 20) {
    Render.ctx.moveTo(x, 0);
    Render.ctx.lineTo(x, Render.bounds.height);
  }

  for(let y = xoffset; y < Render.bounds.height; y += Render.bounds.height / 20) {
    Render.ctx.moveTo(0, y);
    Render.ctx.lineTo(x, Render.bounds.width);
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

