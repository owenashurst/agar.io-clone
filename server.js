console.log('[STARTING SERVER]');

import path from 'path';
import express from 'express';
import webpack from 'webpack';
import webpackMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import config from './webpack.config.js';

const isDeveloping = process.env.NODE_ENV !== 'production';
const app = express();

if (isDeveloping) {
  const compiler = webpack(config);
  const middleware = webpackMiddleware(compiler, {
    publicPath: config.output.publicPath,
    contentBase: 'src',
    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false
    }
  });

  app.use(middleware);
  app.use(webpackHotMiddleware(compiler));
  app.get('*', function response(req, res) {
    res.write(middleware.fileSystem.readFileSync(path.join(__dirname, 'dist/index.html')));
    res.end();
  });
} else {
  app.use(express.static(__dirname + '/dist'));
  app.get('*', function response(req, res) {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });
}

import Http from 'http';
import IO from 'socket.io';
import SAT from 'sat';
import Config from './config.json';
import Util from './lib/util';
import QuadTree from 'simple-quadtree';

const http = (Http).Server(app);
const io = (IO)(http);
const qt = QuadTree(0, 0, Config.gameHeight, Config.gameWidth, {maxChildren: 1});

const users = [];
const massFood = [];
const food = [];
const virus = [];
const sockets = {};

let leaderboard = [];
let leaderboardChanged = false;

const V = SAT.Vector;
const C = SAT.Circle;

const initMassLog = Util.log(Config.defaultPlayerMass, Config.slowBase);

function addFood(add) {
  const radius = Util.massToRadius(Config.foodMass);
  let toAdd = add;
  while (toAdd--) {
    const position = Config.foodUniformDisposition ? Util.uniformPosition(food, radius) : Util.randomPosition(radius);
    food.push({
      // Make IDs unique.
      id: ((new Date()).getTime() + '' + food.length) >>> 0,
      x: position.x,
      y: position.y,
      radius: radius,
      mass: Math.random() + 2,
      hue: Math.round(Math.random() * 360)
    });
  }
}

function addVirus(add) {
  let toAdd = add;
  while (toAdd--) {
    const mass = Util.randomInRange(Config.virus.defaultMass.from, Config.virus.defaultMass.to, true);
    const radius = Util.massToRadius(mass);
    const position = Config.virusUniformDisposition ? Util.uniformPosition(virus, radius) : Util.randomPosition(radius);
    virus.push({
      id: ((new Date()).getTime() + '' + virus.length) >>> 0,
      x: position.x,
      y: position.y,
      radius: radius,
      mass: mass,
      fill: Config.virus.fill,
      stroke: Config.virus.stroke,
      strokeWidth: Config.virus.strokeWidth
    });
  }
}

function removeFood(rem) {
  let toRem = rem;
  while (toRem--) {
    food.pop();
  }
}

function movePlayer(player) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < player.cells.length; i++) {
    const target = {
      x: player.x - player.cells[i].x + player.target.x,
      y: player.y - player.cells[i].y + player.target.y
    };
    const dist = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
    const deg = Math.atan2(target.y, target.x);
    let slowDown = 1;
    if (player.cells[i].speed <= 6.25) {
      slowDown = Util.log(player.cells[i].mass, Config.slowBase) - initMassLog + 1;
    }

    let deltaY = player.cells[i].speed * Math.sin(deg) / slowDown;
    let deltaX = player.cells[i].speed * Math.cos(deg) / slowDown;

    if (player.cells[i].speed > 6.25) {
      player.cells[i].speed -= 0.5;
    }
    if (dist < (50 + player.cells[i].radius)) {
      deltaY *= dist / (50 + player.cells[i].radius);
      deltaX *= dist / (50 + player.cells[i].radius);
    }
    if (!isNaN(deltaY)) {
      player.cells[i].y += deltaY;
    }
    if (!isNaN(deltaX)) {
      player.cells[i].x += deltaX;
    }
    // Find best solution.
    for (let j = 0; j < player.cells.length; j++) {
      if (j !== i && player.cells[i] !== undefined) {
        const distance = Math.sqrt(Math.pow(player.cells[j].y - player.cells[i].y, 2) + Math.pow(player.cells[j].x - player.cells[i].x, 2));
        const radiusTotal = (player.cells[i].radius + player.cells[j].radius);
        if (distance < radiusTotal) {
          if (player.lastSplit > new Date().getTime() - 1000 * Config.mergeTimer) {
            if (player.cells[i].x < player.cells[j].x) {
              player.cells[i].x--;
            } else if (player.cells[i].x > player.cells[j].x) {
              player.cells[i].x++;
            }
            if (player.cells[i].y < player.cells[j].y) {
              player.cells[i].y--;
            } else if ((player.cells[i].y > player.cells[j].y)) {
              player.cells[i].y++;
            }
          } else if (distance < radiusTotal / 1.75) {
            player.cells[i].mass += player.cells[j].mass;
            player.cells[i].radius = Util.massToRadius(player.cells[i].mass);
            player.cells.splice(j, 1);
          }
        }
      }
    }
    if (player.cells.length > i) {
      const borderCalc = player.cells[i].radius / 3;
      if (player.cells[i].x > Config.gameWidth - borderCalc) {
        player.cells[i].x = Config.gameWidth - borderCalc;
      }
      if (player.cells[i].y > Config.gameHeight - borderCalc) {
        player.cells[i].y = Config.gameHeight - borderCalc;
      }
      if (player.cells[i].x < borderCalc) {
        player.cells[i].x = borderCalc;
      }
      if (player.cells[i].y < borderCalc) {
        player.cells[i].y = borderCalc;
      }
      x += player.cells[i].x;
      y += player.cells[i].y;
    }
  }
  player.x = x / player.cells.length;
  player.y = y / player.cells.length;
}

function moveMass(mass) {
  const deg = Math.atan2(mass.target.y, mass.target.x);
  const deltaY = mass.speed * Math.sin(deg);
  const deltaX = mass.speed * Math.cos(deg);

  mass.speed -= 0.5;
  if (mass.speed < 0) {
    mass.speed = 0;
  }
  if (!isNaN(deltaY)) {
    mass.y += deltaY;
  }
  if (!isNaN(deltaX)) {
    mass.x += deltaX;
  }

  const borderCalc = mass.radius + 5;

  if (mass.x > Config.gameWidth - borderCalc) {
    mass.x = Config.gameWidth - borderCalc;
  }
  if (mass.y > Config.gameHeight - borderCalc) {
    mass.y = Config.gameHeight - borderCalc;
  }
  if (mass.x < borderCalc) {
    mass.x = borderCalc;
  }
  if (mass.y < borderCalc) {
    mass.y = borderCalc;
  }
}

function balanceMass() {
  const totalMass = food.length * Config.foodMass + users
  .map((u) => { return u.massTotal; })
  .reduce((pu, cu) => { return pu + cu; }, 0);

  const massDiff = Config.gameMass - totalMass;
  const maxFoodDiff = Config.maxFood - food.length;
  const foodDiff = parseInt(massDiff / Config.foodMass, 10) - maxFoodDiff;
  const foodToAdd = Math.min(foodDiff, maxFoodDiff);
  const foodToRemove = -Math.max(foodDiff, maxFoodDiff);

  if (foodToAdd > 0) {
    // console.log('[DEBUG] Adding ' + foodToAdd + ' food to level!');
    addFood(foodToAdd);
    // console.log('[DEBUG] Mass rebalanced!');
  } else if (foodToRemove > 0) {
    // console.log('[DEBUG] Removing ' + foodToRemove + ' food from level!');
    removeFood(foodToRemove);
    // console.log('[DEBUG] Mass rebalanced!');
  }

  const virusToAdd = Config.maxVirus - virus.length;

  if (virusToAdd > 0) {
    addVirus(virusToAdd);
  }
}

io.on('connection', (socket) => {
  console.log('A user connected!', socket.handshake.query.type);

  const type = socket.handshake.query.type;
  let radius = Util.massToRadius(Config.defaultPlayerMass);
  let position = Config.newPlayerInitialPosition === 'farthest' ? Util.uniformPosition(users, radius) : Util.randomPosition(radius);
  let cells = [];
  let massTotal = 0;

  if (type === 'player') {
    cells = [{
      mass: Config.defaultPlayerMass,
      x: position.x,
      y: position.y,
      radius: radius
    }];
    massTotal = Config.defaultPlayerMass;
  }

  let currentPlayer = {
    id: socket.id,
    x: position.x,
    y: position.y,
    cells: cells,
    massTotal: massTotal,
    hue: Math.round(Math.random() * 360),
    type: type,
    lastHeartbeat: new Date().getTime(),
    target: {
      x: 0,
      y: 0
    }
  };

  socket.on('gotit', (player) => {
    console.log('[INFO] Player ' + player.name + ' connecting!');

    if (Util.findIndex(users, player.id) > -1) {
      console.log('[INFO] Player ID is already connected, kicking.');
      socket.disconnect();
    } else if (!Util.validNick(player.name)) {
      socket.emit('kick', 'Invalid username.');
      socket.disconnect();
    } else {
      console.log('[INFO] Player ' + player.name + ' connected!');
      sockets[player.id] = socket;

      radius = Util.massToRadius(Config.defaultPlayerMass);
      position = Config.newPlayerInitialPosition === 'farthest' ? Util.uniformPosition(users, radius) : Util.randomPosition(radius);

      player.x = position.x;
      player.y = position.y;
      player.target.x = 0;
      player.target.y = 0;

      if (type === 'player') {
        player.cells = [{
          mass: Config.defaultPlayerMass,
          x: position.x,
          y: position.y,
          radius: radius
        }];
        player.massTotal = Config.defaultPlayerMass;
      } else {
        player.cells = [];
        player.massTotal = 0;
      }
      player.hue = Math.round(Math.random() * 360);
      currentPlayer = player;
      currentPlayer.lastHeartbeat = new Date().getTime();
      users.push(currentPlayer);

      io.emit('playerJoin', { name: currentPlayer.name });

      socket.emit('gameSetup', {
        gameWidth: Config.gameWidth,
        gameHeight: Config.gameHeight
      });
      console.log('Total players: ' + users.length);
    }
  });

  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('windowResized', (data) => {
    currentPlayer.screenWidth = data.screenWidth;
    currentPlayer.screenHeight = data.screenHeight;
  });

  socket.on('respawn', () => {
    if (Util.findIndex(users, currentPlayer.id) > -1) {
      users.splice(Util.findIndex(users, currentPlayer.id), 1);
    }
    socket.emit('welcome', currentPlayer);
    console.log('[INFO] User ' + currentPlayer.name + ' respawned!');
  });

  socket.on('disconnect', () => {
    if (Util.findIndex(users, currentPlayer.id) > -1) {
      users.splice(Util.findIndex(users, currentPlayer.id), 1);
    }
    console.log('[INFO] User ' + currentPlayer.name + ' disconnected!');
    socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
  });

  socket.on('playerChat', (data) => {
    const _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
    const _message = data.message.replace(/(<([^>]+)>)/ig, '');
    if (Config.logChat === 1) {
      console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
    }
    socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0, 35)});
  });

  socket.on('pass', (data) => {
    if (data[0] === Config.adminPass) {
      console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin!');
      socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
      socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as admin!');
      currentPlayer.admin = true;
    } else {
      console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with incorrect password.');
      socket.emit('serverMSG', 'Password incorrect, attempt logged.');
      // TODO: Actually log incorrect passwords.
    }
  });

  socket.on('kick', (data) => {
    if (currentPlayer.admin) {
      let reason = '';
      let worked = false;
      for (let e = 0; e < users.length; e++) {
        if (users[e].name === data[0] && !users[e].admin && !worked) {
          if (data.length > 1) {
            for (let f = 1; f < data.length; f++) {
              if (f === data.length) {
                reason = reason + data[f];
              } else {
                reason = reason + data[f] + ' ';
              }
            }
          }
          if (reason !== '') {
            console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
          } else {
            console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name);
          }
          socket.emit('serverMSG', 'User ' + users[e].name + ' was kicked by ' + currentPlayer.name);
          sockets[users[e].id].emit('kick', reason);
          sockets[users[e].id].disconnect();
          users.splice(e, 1);
          worked = true;
        }
      }
      if (!worked) {
        socket.emit('serverMSG', 'Could not locate user or user is an admin.');
      }
    } else {
      console.log('[ADMIN] ' + currentPlayer.name + ' is trying to use -kick but isn\'t an admin.');
      socket.emit('serverMSG', 'You are not permitted to use this command.');
    }
  });

  // Heartbeat function, update everytime.
  socket.on('0', (target) => {
    currentPlayer.lastHeartbeat = new Date().getTime();
    if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
      currentPlayer.target = target;
    }
  });

  socket.on('1', () => {
    // Fire food.
    for (let i = 0; i < currentPlayer.cells.length; i++) {
      if (((currentPlayer.cells[i].mass >= Config.defaultPlayerMass + Config.fireFood) && Config.fireFood > 0) || (currentPlayer.cells[i].mass >= 20 && Config.fireFood === 0)) {
        let masa = 1;
        if (Config.fireFood > 0)  {
          masa = Config.fireFood;
        } else {
          masa = currentPlayer.cells[i].mass * 0.1;
        }

        currentPlayer.cells[i].mass -= masa;
        currentPlayer.massTotal -= masa;
        massFood.push({
          id: currentPlayer.id,
          num: i,
          masa: masa,
          hue: currentPlayer.hue,
          target: {
            x: currentPlayer.x - currentPlayer.cells[i].x + currentPlayer.target.x,
            y: currentPlayer.y - currentPlayer.cells[i].y + currentPlayer.target.y
          },
          x: currentPlayer.cells[i].x,
          y: currentPlayer.cells[i].y,
          radius: Util.massToRadius(masa),
          speed: 25
        });
      }
    }
  });

  socket.on('2', (virusCell) => {
    function splitCell(cell) {
      if (cell.mass >= Config.defaultPlayerMass * 2) {
        cell.mass = cell.mass / 2;
        cell.radius = Util.massToRadius(cell.mass);
        currentPlayer.cells.push({
          mass: cell.mass,
          x: cell.x,
          y: cell.y,
          radius: cell.radius,
          speed: 25
        });
      }
    }

    if (currentPlayer.cells.length < Config.limitSplit && currentPlayer.massTotal >= Config.defaultPlayerMass * 2) {
      // Split single cell from virus
      if (virusCell) {
        splitCell(currentPlayer.cells[virusCell]);
      } else {
        // Split all cells
        if (currentPlayer.cells.length < Config.limitSplit && currentPlayer.massTotal >= Config.defaultPlayerMass * 2) {
          const numMax = currentPlayer.cells.length;
          for (let d = 0; d < numMax; d++) {
            splitCell(currentPlayer.cells[d]);
          }
        }
      }
      currentPlayer.lastSplit = new Date().getTime();
    }
  });
});

function tickPlayer(currentPlayer) {
  // TODO: THIS SHOULD NOT HAVE TO BE DECLARED HERE FIX CALL ORDER
  let z = 0;

  if (currentPlayer.lastHeartbeat < new Date().getTime() - Config.maxHeartbeatInterval) {
    sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + Config.maxHeartbeatInterval + ' ago.');
    sockets[currentPlayer.id].disconnect();
  }

  movePlayer(currentPlayer);

  function deleteFood(f) {
    food[f] = {};
    food.splice(f, 1);
  }

  function collisionCheck(collision) {
    if (collision.aUser.mass > collision.bUser.mass * 1.1  && collision.aUser.radius > Math.sqrt(Math.pow(collision.aUser.x - collision.bUser.x, 2) + Math.pow(collision.aUser.y - collision.bUser.y, 2)) * 1.75) {
      console.log('[DEBUG] Killing user: ' + collision.bUser.id);
      console.log('[DEBUG] Collision info:');

      const numUser = Util.findIndex(users, collision.bUser.id);
      if (numUser > -1) {
        if (users[numUser].cells.length > 1) {
          users[numUser].massTotal -= collision.bUser.mass;
          users[numUser].cells.splice(collision.bUser.num, 1);
        } else {
          users.splice(numUser, 1);
          io.emit('playerDied', { name: collision.bUser.name });
          sockets[collision.bUser.id].emit('RIP');
        }
      }
      currentPlayer.massTotal += collision.bUser.mass;
      collision.aUser.mass += collision.bUser.mass;
    }
  }

  let playerCircle = {};
  let currentCell = {};
  const playerCollisions = [];

  function check(user) {
    for (let i = 0; i < user.cells.length; i++) {
      if (user.cells[i].mass > 10 && user.id !== currentPlayer.id) {
        const response = new SAT.Response();
        const collided = SAT.testCircleCircle(playerCircle,
            new C(new V(user.cells[i].x, user.cells[i].y), user.cells[i].radius),
            response);
        if (collided) {
          response.aUser = currentCell;
          response.bUser = {
            id: user.id,
            name: user.name,
            x: user.cells[i].x,
            y: user.cells[i].y,
            num: i,
            mass: user.cells[i].mass
          };
          playerCollisions.push(response);
        }
      }
    }
  }

  function eatMass(m) {
    if (SAT.pointInCircle(new V(m.x, m.y), playerCircle)) {
      if (m.id === currentPlayer.id && m.speed > 0 && z === m.num) {
        return false;
      }
      if (currentCell.mass > m.masa * 1.1) {
        return true;
      }
    }
    return false;
  }

  function funcFood(f) {
    return SAT.pointInCircle(new V(f.x, f.y), playerCircle);
  }

  // TODO: FIX THIS Z VARIABLE AND EATMASS()
  for (z = 0; z < currentPlayer.cells.length; z++) {
    currentCell = currentPlayer.cells[z];
    playerCircle = new C(
      new V(currentCell.x, currentCell.y),
      currentCell.radius
    );

    const foodEaten = food.map(funcFood)
      .reduce((a, b, c) => { return b ? a.concat(c) : a; }, []);

    foodEaten.forEach(deleteFood);
    const massEaten = massFood.map(eatMass)
      .reduce((a, b, c) => {return b ? a.concat(c) : a; }, []);

    const virusCollision = virus.map(funcFood)
      .reduce((a, b, c) => { return b ? a.concat(c) : a; }, []);

    if (virusCollision > 0 && currentCell.mass > virus[virusCollision].mass) {
      sockets[currentPlayer.id].emit('virusSplit', z);
    }

    let masaGanada = 0;
    for (let m = 0; m < massEaten.length; m++) {
      masaGanada += massFood[massEaten[m]].masa;
      massFood[massEaten[m]] = {};
      massFood.splice(massEaten[m], 1);
      for (let n = 0; n < massEaten.length; n++) {
        if (massEaten[m] < massEaten[n]) {
          massEaten[n]--;
        }
      }
    }

    if (typeof(currentCell.speed) === 'undefined') {
      currentCell.speed = 6.25;
    }

    masaGanada += (foodEaten.length * Config.foodMass);
    currentCell.mass += masaGanada;
    currentPlayer.massTotal += masaGanada;
    currentCell.radius = Util.massToRadius(currentCell.mass);
    playerCircle.r = currentCell.radius;
    qt.clear();
    qt.put(users);

    // TODO: TEST TO MAKE SURE PLAYER COLLISSIONS WORK
    qt.get(currentPlayer, 1, check);

    playerCollisions.forEach(collisionCheck);
  }
}

function moveloop() {
  for (let i = 0; i < users.length; i++) {
    tickPlayer(users[i]);
  }
  for (let i = 0; i < massFood.length; i++) {
    if (massFood[i].speed > 0) {
      moveMass(massFood[i]);
    }
  }
}

function gameloop() {
  if (users.length > 0) {
    users.sort((a, b) => { return b.massTotal - a.massTotal; });

    const topUsers = [];

    for (let i = 0; i < Math.min(10, users.length); i++) {
      if (users[i].type === 'player') {
        topUsers.push({
          id: users[i].id,
          name: users[i].name
        });
      }
    }
    if (isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
      leaderboard = topUsers;
      leaderboardChanged = true;
    } else {
      for (let i = 0; i < leaderboard.length; i++) {
        if (leaderboard[i].id !== topUsers[i].id) {
          leaderboard = topUsers;
          leaderboardChanged = true;
          break;
        }
      }
    }
    for (let i = 0; i < users.length; i++) {
      for (let z = 0; z < users[i].cells.length; z++) {
        if (users[i].cells[z].mass * (1 - (Config.massLossRate / 1000)) > Config.defaultPlayerMass) {
          const massLoss = users[i].cells[z].mass * (1 - (Config.massLossRate / 1000));
          users[i].massTotal -= users[i].cells[z].mass - massLoss;
          users[i].cells[z].mass = massLoss;
        }
      }
    }
  }
  balanceMass();
}

function sendUpdates() {
  users.forEach((u) => {
    // center the view if x/y is undefined, this will happen for spectators
    u.x = u.x || Config.gameWidth / 2;
    u.y = u.y || Config.gameHeight / 2;

    const visibleFood  = food
      .map((f) => {
        if ( f.x > u.x - u.screenWidth / 2 - 20 &&
        f.x < u.x + u.screenWidth / 2 + 20 &&
        f.y > u.y - u.screenHeight / 2 - 20 &&
        f.y < u.y + u.screenHeight / 2 + 20) {
          return f;
        }
      })
      .filter((f) => { return f; });

    const visibleVirus  = virus
        .map((f) => {
          if ( f.x > u.x - u.screenWidth / 2 - f.radius &&
          f.x < u.x + u.screenWidth / 2 + f.radius &&
          f.y > u.y - u.screenHeight / 2 - f.radius &&
          f.y < u.y + u.screenHeight / 2 + f.radius) {
            return f;
          }
        })
        .filter((f) => { return f; });

    const visibleMass = massFood
        .map((f) => {
          if ( f.x + f.radius > u.x - u.screenWidth / 2 - 20 &&
          f.x - f.radius < u.x + u.screenWidth / 2 + 20 &&
          f.y + f.radius > u.y - u.screenHeight / 2 - 20 &&
          f.y - f.radius < u.y + u.screenHeight / 2 + 20) {
            return f;
          }
        })
        .filter((f) => { return f; });

    const visibleCells  = users
        .map((f) => {
          for (let z = 0; z < f.cells.length; z++) {
            if ( f.cells[z].x + f.cells[z].radius > u.x - u.screenWidth / 2 - 20 &&
            f.cells[z].x - f.cells[z].radius < u.x + u.screenWidth / 2 + 20 &&
            f.cells[z].y + f.cells[z].radius > u.y - u.screenHeight / 2 - 20 &&
            f.cells[z].y - f.cells[z].radius < u.y + u.screenHeight / 2 + 20) {
              z = f.cells.lenth;
              if (f.id !== u.id) {
                return {
                  id: f.id,
                  x: f.x,
                  y: f.y,
                  cells: f.cells,
                  massTotal: Math.round(f.massTotal),
                  hue: f.hue,
                  name: f.name
                };
              }
              // console.log("Nombre: " + f.name + " Es Usuario");
              return {
                x: f.x,
                y: f.y,
                cells: f.cells,
                massTotal: Math.round(f.massTotal),
                hue: f.hue
              };
            }
          }
        })
        .filter((f) => { return f; });

    sockets[u.id].emit('serverTellPlayerMove', visibleCells, visibleFood, visibleMass, visibleVirus);
    if (leaderboardChanged) {
      sockets[u.id].emit('leaderboard', {
        players: users.length,
        leaderboard: leaderboard
      });
    }
  });
  leaderboardChanged = false;
}

setInterval(moveloop, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / Config.networkUpdateFactor);

// Don't touch, IP configurations.
const ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
const serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || Config.port;
if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
  http.listen( serverport, ipaddress, () => {
    console.log('[DEBUG] Listening on *:' + serverport);
  });
} else {
  http.listen( serverport, () => {
    console.log('[DEBUG] Listening on *:' + Config.port);
  });
}
