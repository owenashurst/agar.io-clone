/*jslint bitwise: true, node: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const quadtree = require('simple-quadtree');
const SAT = require('sat');
const loggingRepositry = require('./repositories/logging-repository');
const config = require('../../config');
const util = require('./lib/util');

const tree = quadtree(0, 0, config.gameWidth, config.gameHeight);

let users = [];
let massFood = [];
let food = [];
let virus = [];
let sockets = {};

let leaderboard = [];
let leaderboardChanged = false;

const Vector = SAT.Vector;
const Circle = SAT.Circle;

var initMassLog = util.log(config.defaultPlayerMass, config.slowBase);

app.use(express.static(__dirname + '/../client'));

const addFood = (toAdd) => {
    var radius = util.massToRadius(config.foodMass);
    while (toAdd--) {
        var position = config.foodUniformDisposition ? util.uniformPosition(food, radius) : util.randomPosition(radius);
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
};

const addVirus = (toAdd) => {
    while (toAdd--) {
        var mass = util.randomInRange(config.virus.defaultMass.from, config.virus.defaultMass.to, true);
        var radius = util.massToRadius(mass);
        var position = config.virusUniformDisposition ? util.uniformPosition(virus, radius) : util.randomPosition(radius);
        virus.push({
            id: ((new Date()).getTime() + '' + virus.length) >>> 0,
            x: position.x,
            y: position.y,
            radius: radius,
            mass: mass,
            fill: config.virus.fill,
            stroke: config.virus.stroke,
            strokeWidth: config.virus.strokeWidth
        });
    }
};

const removeFood = (toRem) => {
    while (toRem--) {
        food.pop();
    }
};

const movePlayer = (player) => {
    let x = 0;
    let y = 0;

    for (let i = 0; i < player.cells.length; i++)
    {
        const target = {
            x: player.x - player.cells[i].x + player.target.x,
            y: player.y - player.cells[i].y + player.target.y
        };

        const distance = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
        const degrees = Math.atan2(target.y, target.x);
        let slowDown = 1;

        if(player.cells[i].speed <= 6.25) {
            slowDown = util.log(player.cells[i].mass, config.slowBase) - initMassLog + 1;
        }

        var deltaY = player.cells[i].speed * Math.sin(degrees) / slowDown;
        var deltaX = player.cells[i].speed * Math.cos(degrees) / slowDown;

        if(player.cells[i].speed > 6.25) {
            player.cells[i].speed -= 0.5;
        }
        if (distance < (50 + player.cells[i].radius)) {
            deltaY *= distance / (50 + player.cells[i].radius);
            deltaX *= distance / (50 + player.cells[i].radius);
        }
        if (!isNaN(deltaY)) {
            player.cells[i].y += deltaY;
        }
        if (!isNaN(deltaX)) {
            player.cells[i].x += deltaX;
        }
        // Find best solution.
        for (let j = 0; j < player.cells.length; j++) {
            if (j != i && player.cells[i] !== undefined) {
                const newDistance = Math.sqrt(Math.pow(player.cells[j].y-player.cells[i].y,2) + Math.pow(player.cells[j].x-player.cells[i].x,2));
                const radiusTotal = (player.cells[i].radius + player.cells[j].radius);

                if (newDistance < radiusTotal) {
                    if(player.lastSplit > new Date().getTime() - 1000 * config.mergeTimer) {
                        if(player.cells[i].x < player.cells[j].x) {
                            player.cells[i].x--;
                        } else if(player.cells[i].x > player.cells[j].x) {
                            player.cells[i].x++;
                        }
                        if(player.cells[i].y < player.cells[j].y) {
                            player.cells[i].y--;
                        } else if((player.cells[i].y > player.cells[j].y)) {
                            player.cells[i].y++;
                        }
                    }
                    else if(newDistance < radiusTotal / 1.75) {
                        player.cells[i].mass += player.cells[j].mass;
                        player.cells[i].radius = util.massToRadius(player.cells[i].mass);
                        player.cells.splice(j, 1);
                    }
                }
            }
        }
        if(player.cells.length > i) {
            var borderCalc = player.cells[i].radius / 3;
            if (player.cells[i].x > config.gameWidth - borderCalc) {
                player.cells[i].x = config.gameWidth - borderCalc;
            }
            if (player.cells[i].y > config.gameHeight - borderCalc) {
                player.cells[i].y = config.gameHeight - borderCalc;
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
    player.x = x/player.cells.length;
    player.y = y/player.cells.length;
};

const moveMass = (mass) => {
    const degrees = Math.atan2(mass.target.y, mass.target.x);
    const deltaY = mass.speed * Math.sin(degrees);
    const deltaX = mass.speed * Math.cos(degrees);

    mass.speed -= 0.5;
    if(mass.speed < 0) {
        mass.speed = 0;
    }
    if (!isNaN(deltaY)) {
        mass.y += deltaY;
    }
    if (!isNaN(deltaX)) {
        mass.x += deltaX;
    }

    const borderCalc = mass.radius + 5;

    if (mass.x > config.gameWidth - borderCalc) {
        mass.x = config.gameWidth - borderCalc;
    }
    if (mass.y > config.gameHeight - borderCalc) {
        mass.y = config.gameHeight - borderCalc;
    }
    if (mass.x < borderCalc) {
        mass.x = borderCalc;
    }
    if (mass.y < borderCalc) {
        mass.y = borderCalc;
    }
};

const balanceMass = () => {
    const totalMass = food.length * config.foodMass +
        users
            .map(function(u) {return u.massTotal; })
            .reduce(function(pu,cu) { return pu+cu;}, 0);

    const massDiff = config.gameMass - totalMass;
    const maxFoodDiff = config.maxFood - food.length;
    const foodDiff = parseInt(massDiff / config.foodMass) - maxFoodDiff;
    const foodToAdd = Math.min(foodDiff, maxFoodDiff);
    const foodToRemove = -Math.max(foodDiff, maxFoodDiff);

    if (foodToAdd > 0) {
        //console.log('[DEBUG] Adding ' + foodToAdd + ' food to level!');
        addFood(foodToAdd);
        //console.log('[DEBUG] Mass rebalanced!');
    }
    else if (foodToRemove > 0) {
        //console.log('[DEBUG] Removing ' + foodToRemove + ' food from level!');
        removeFood(foodToRemove);
        //console.log('[DEBUG] Mass rebalanced!');
    }

    var virusToAdd = config.maxVirus - virus.length;

    if (virusToAdd > 0) {
        addVirus(virusToAdd);
    }
};

io.on('connection', function (socket) {
    console.log('User has connected: ', socket.handshake.query.type);

    var type = socket.handshake.query.type;
    var radius = util.massToRadius(config.defaultPlayerMass);
    var position = config.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

    var cells = [];
    var massTotal = 0;
    if(type === 'player') {
        cells = [{
            mass: config.defaultPlayerMass,
            x: position.x,
            y: position.y,
            radius: radius
        }];
        massTotal = config.defaultPlayerMass;
    }

    var currentPlayer = {
        id: socket.id,
        ipAddress: socket.handshake.address,
        x: position.x,
        y: position.y,
        w: config.defaultPlayerMass,
        h: config.defaultPlayerMass,
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

    socket.on('gotit', function (player) {
        console.log('[INFO] Player ' + player.name + ' connecting!');

        if (util.findIndex(users, player.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + player.name + ' connected!');
            sockets[player.id] = socket;

            var radius = util.massToRadius(config.defaultPlayerMass);
            var position = config.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

            player.x = position.x;
            player.y = position.y;
            player.target.x = 0;
            player.target.y = 0;
            if(type === 'player') {
                player.cells = [{
                    mass: config.defaultPlayerMass,
                    x: position.x,
                    y: position.y,
                    radius: radius
                }];
                player.massTotal = config.defaultPlayerMass;
            }
            else {
                 player.cells = [];
                 player.massTotal = 0;
            }
            player.hue = Math.round(Math.random() * 360);
            currentPlayer = player;
            currentPlayer.lastHeartbeat = new Date().getTime();
            users.push(currentPlayer);

            io.emit('playerJoin', { name: currentPlayer.name });

            socket.emit('gameSetup', {
                gameWidth: config.gameWidth,
                gameHeight: config.gameHeight
            });
            console.log('Total players: ' + users.length);
        }

    });

    socket.on('pingcheck', function () {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', function (data) {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', function () {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        socket.emit('welcome', currentPlayer);
        console.log('[INFO] User ' + currentPlayer.name + ' respawned!');
    });

    socket.on('disconnect', function () {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        console.log('[INFO] User ' + currentPlayer.name + ' disconnected!');

        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        if (config.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0,35)});
    });

    socket.on('pass', async (data) => {
        const password = data[0];
        if (password === config.adminPass) {
            console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin.');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as an admin.');
            currentPlayer.admin = true;
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with incorrect password.');
            socket.emit('serverMSG', 'Password incorrect, attempt logged.');
            loggingRepositry.logFailedLoginAttempt(currentPlayer.name, currentPlayer.ipAddress)
            .catch((err) => console.error("Error when attempting to log failed login attempt", err));
        }
    });

    socket.on('kick', (data) => {
        if (currentPlayer.admin) {
            var reason = '';
            var worked = false;
            for (var e = 0; e < users.length; e++) {
                if (users[e].name === data[0] && !users[e].admin && !worked) {
                    if (data.length > 1) {
                        for (var f = 1; f < data.length; f++) {
                            if (f === data.length) {
                                reason = reason + data[f];
                            }
                            else {
                                reason = reason + data[f] + ' ';
                            }
                        }
                    }
                    if (reason !== '') {
                       console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
                    }
                    else {
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
    socket.on('0', function(target) {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function() {
        // Fire food.
        for(var i=0; i<currentPlayer.cells.length; i++)
        {
            if(((currentPlayer.cells[i].mass >= config.defaultPlayerMass + config.fireFood) && config.fireFood > 0) || (currentPlayer.cells[i].mass >= 20 && config.fireFood === 0)){
                var masa = 1;
                if(config.fireFood > 0)
                    masa = config.fireFood;
                else
                    masa = currentPlayer.cells[i].mass*0.1;
                currentPlayer.cells[i].mass -= masa;
                currentPlayer.massTotal -=masa;
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
                    radius: util.massToRadius(masa),
                    speed: 25
                });
            }
        }
    });
    socket.on('2', function(virusCell) {
        function splitCell(cell) {
            if(cell && cell.mass && cell.mass >= config.defaultPlayerMass*2) {
                cell.mass = cell.mass/2;
                cell.radius = util.massToRadius(cell.mass);
                currentPlayer.cells.push({
                    mass: cell.mass,
                    x: cell.x,
                    y: cell.y,
                    radius: cell.radius,
                    speed: 25
                });
            }
        }

        if(currentPlayer.cells.length < config.limitSplit && currentPlayer.massTotal >= config.defaultPlayerMass*2) {
            //Split single cell from virus
            if(virusCell) {
              splitCell(currentPlayer.cells[virusCell]);
            }
            else {
              //Split all cells
              if(currentPlayer.cells.length < config.limitSplit && currentPlayer.massTotal >= config.defaultPlayerMass*2) {
                  var numMax = currentPlayer.cells.length;
                  for(var d=0; d<numMax; d++) {
                      splitCell(currentPlayer.cells[d]);
                  }
              }
            }
            currentPlayer.lastSplit = new Date().getTime();
        }
    });
});

function tickPlayer(currentPlayer) {
    if(currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }

    movePlayer(currentPlayer);

    function funcFood(f) {
        return SAT.pointInCircle(new Vector(f.x, f.y), playerCircle);
    }

    function deleteFood(f) {
        food[f] = {};
        food.splice(f, 1);
    }

    function eatMass(m) {
        if(SAT.pointInCircle(new Vector(m.x, m.y), playerCircle)){
            if(m.id == currentPlayer.id && m.speed > 0 && z == m.num)
                return false;
            if(currentCell.mass > m.masa * 1.1)
                return true;
        }
        return false;
    }

    function check(user) {
        for(var i=0; i<user.cells.length; i++) {
            if(user.cells[i].mass > 10 && user.id !== currentPlayer.id) {
                var response = new SAT.Response();
                var collided = SAT.testCircleCircle(playerCircle,
                    new Circle(new Vector(user.cells[i].x, user.cells[i].y), user.cells[i].radius),
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
        return true;
    }

    function collisionCheck(collision) {
        if (collision.aUser.mass > collision.bUser.mass * 1.1  && collision.aUser.radius > Math.sqrt(Math.pow(collision.aUser.x - collision.bUser.x, 2) + Math.pow(collision.aUser.y - collision.bUser.y, 2))*1.75) {
            console.log('[DEBUG] Killing user: ' + collision.bUser.id);
            console.log('[DEBUG] Collision info:');
            console.log(collision);

            var numUser = util.findIndex(users, collision.bUser.id);
            if (numUser > -1) {
                if(users[numUser].cells.length > 1) {
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

    for(var z=0; z<currentPlayer.cells.length; z++) {
        var currentCell = currentPlayer.cells[z];
        var playerCircle = new Circle(
            new Vector(currentCell.x, currentCell.y),
            currentCell.radius
        );

        var foodEaten = food.map(funcFood)
            .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

        foodEaten.forEach(deleteFood);

        var massEaten = massFood.map(eatMass)
            .reduce(function(a, b, c) {return b ? a.concat(c) : a; }, []);

        var virusCollision = virus.map(funcFood)
           .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

        if(virusCollision > 0 && currentCell.mass > virus[virusCollision].mass) {
          sockets[currentPlayer.id].emit('virusSplit', z);
          virus.splice(virusCollision, 1);
        }

        var masaGanada = 0;
        for(var m=0; m<massEaten.length; m++) {
            masaGanada += massFood[massEaten[m]].masa;
            massFood[massEaten[m]] = {};
            massFood.splice(massEaten[m],1);
            for(var n=0; n<massEaten.length; n++) {
                if(massEaten[m] < massEaten[n]) {
                    massEaten[n]--;
                }
            }
        }

        if(typeof(currentCell.speed) == "undefined")
            currentCell.speed = 6.25;
        masaGanada += (foodEaten.length * config.foodMass);
        currentCell.mass += masaGanada;
        currentPlayer.massTotal += masaGanada;
        currentCell.radius = util.massToRadius(currentCell.mass);
        playerCircle.r = currentCell.radius;

        tree.clear();
        users.forEach(tree.put);
        var playerCollisions = [];

        var otherUsers =  tree.get(currentPlayer, check);

        playerCollisions.forEach(collisionCheck);
    }
}

function moveloop() {
    for (var i = 0; i < users.length; i++) {
        tickPlayer(users[i]);
    }
    for (i=0; i < massFood.length; i++) {
        if(massFood[i].speed > 0) moveMass(massFood[i]);
    }
}

function gameloop() {
    if (users.length > 0) {
        users.sort( function(a, b) { return b.massTotal - a.massTotal; });

        var topUsers = [];

        for (var i = 0; i < Math.min(10, users.length); i++) {
            if(users[i].type == 'player') {
                topUsers.push({
                    id: users[i].id,
                    name: users[i].name
                });
            }
        }
        if (isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
            leaderboard = topUsers;
            leaderboardChanged = true;
        }
        else {
            for (i = 0; i < leaderboard.length; i++) {
                if (leaderboard[i].id !== topUsers[i].id) {
                    leaderboard = topUsers;
                    leaderboardChanged = true;
                    break;
                }
            }
        }
        for (i = 0; i < users.length; i++) {
            for(var z=0; z < users[i].cells.length; z++) {
                if (users[i].cells[z].mass * (1 - (config.massLossRate / 1000)) > config.defaultPlayerMass && users[i].massTotal > config.minMassLoss) {
                    var massLoss = users[i].cells[z].mass * (1 - (config.massLossRate / 1000));
                    users[i].massTotal -= users[i].cells[z].mass - massLoss;
                    users[i].cells[z].mass = massLoss;
                }
            }
        }
    }
    balanceMass();
}

function sendUpdates() {
    users.forEach( function(u) {
        // center the view if x/y is undefined, this will happen for spectators
        u.x = u.x || config.gameWidth / 2;
        u.y = u.y || config.gameHeight / 2;

        var visibleFood  = food
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - 20 &&
                    f.x < u.x + u.screenWidth/2 + 20 &&
                    f.y > u.y - u.screenHeight/2 - 20 &&
                    f.y < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleVirus  = virus
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - f.radius &&
                    f.x < u.x + u.screenWidth/2 + f.radius &&
                    f.y > u.y - u.screenHeight/2 - f.radius &&
                    f.y < u.y + u.screenHeight/2 + f.radius) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleMass = massFood
            .map(function(f) {
                if ( f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
                    f.y-f.radius < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleCells  = users
            .map(function(f) {
                for(var z=0; z<f.cells.length; z++)
                {
                    if ( f.cells[z].x+f.cells[z].radius > u.x - u.screenWidth/2 - 20 &&
                        f.cells[z].x-f.cells[z].radius < u.x + u.screenWidth/2 + 20 &&
                        f.cells[z].y+f.cells[z].radius > u.y - u.screenHeight/2 - 20 &&
                        f.cells[z].y-f.cells[z].radius < u.y + u.screenHeight/2 + 20) {
                        z = f.cells.lenth;
                        if(f.id !== u.id) {
                            return {
                                id: f.id,
                                x: f.x,
                                y: f.y,
                                cells: f.cells,
                                massTotal: Math.round(f.massTotal),
                                hue: f.hue,
                                name: f.name
                            };
                        } else {
                            //console.log("Nombre: " + f.name + " Es Usuario");
                            return {
                                x: f.x,
                                y: f.y,
                                cells: f.cells,
                                massTotal: Math.round(f.massTotal),
                                hue: f.hue,
                            };
                        }
                    }
                }
            })
            .filter(function(f) { return f; });

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
setInterval(sendUpdates, 1000 / config.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
http.listen( serverport, ipaddress, function() {
    console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
