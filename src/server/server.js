/*jslint bitwise: true, node: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const quadtree = require('simple-quadtree');
const SAT = require('sat');

const gameLogic = require('./game-logic');
const playerLogic = require('./player');
const loggingRepositry = require('./repositories/logging-repository');
const chatRepository = require('./repositories/chat-repository');
const config = require('../../config');
const util = require('./lib/util');

const tree = quadtree(0, 0, config.gameWidth, config.gameHeight);

let users = [];
let massFood = [];
let food = [];
let viruses = [];
let sockets = {};

let leaderboard = [];
let leaderboardChanged = false;

const Vector = SAT.Vector;
const Circle = SAT.Circle;

let playerCircle = new Circle(new Vector(0, 0), 0); 

app.use(express.static(__dirname + '/../client'));

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

    socket.on('pingcheck', () => {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', (data) => {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', () => {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        socket.emit('welcome', currentPlayer);
        console.log('[INFO] User ' + currentPlayer.name + ' has respawned');
    });

    socket.on('disconnect', () => {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        console.log('[INFO] User ' + currentPlayer.name + ' has disconnected');

        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', (data) => {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');

        if (config.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }

        socket.broadcast.emit('serverSendPlayerChat', {
            sender: _sender,
            message: _message.substring(0,35)
        });

        chatRepository.logChatMessage(_sender, _message, currentPlayer.ipAddress)
        .catch((err) => console.error("Error when attempting to log chat message", err));
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
        if (!currentPlayer.admin) {
            socket.emit('serverMSG', 'You are not permitted to use this command.');
            return;
        }

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
    });

    // Heartbeat function, update everytime.
    socket.on('0', (target) => {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function() {
        // Fire food.
        for (let i = 0; i < currentPlayer.cells.length; i++)
        {
            if (((currentPlayer.cells[i].mass >= config.defaultPlayerMass + config.fireFood) && config.fireFood > 0) || (currentPlayer.cells[i].mass >= 20 && config.fireFood === 0)){
                let masa = 1;

                if (config.fireFood > 0) {
                    masa = config.fireFood;
                }
                else {
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
        }
    });

    socket.on('2', (virusCell) => {
        const splitCell = (cell) => {
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
        };

        if(currentPlayer.cells.length < config.limitSplit && currentPlayer.massTotal >= config.defaultPlayerMass*2) {
            // Split single cell from virus
            if (virusCell) {
                splitCell(currentPlayer.cells[virusCell]);
            }
            else {
                // Split all cells
                if(currentPlayer.cells.length < config.limitSplit && currentPlayer.massTotal >= config.defaultPlayerMass*2) {
                    const currentPlayersCells = currentPlayer.cells;
                    for (let i = 0; i < currentPlayersCells.length; i++) {
                        splitCell(currentPlayersCells[i]);
                    }
                }
            }

            currentPlayer.lastSplit = new Date().getTime();
        }
    });
});

const tickPlayer = (currentPlayer) => {
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }

    playerLogic.movePlayer(currentPlayer);

    const funcFood = (f) => {
        return SAT.pointInCircle(new Vector(f.x, f.y), playerCircle);
    };

    const deleteFood = (f) => {
        food[f] = {};
        food.splice(f, 1);
    };

    const eatMass = (m, currentCell) => {
        if (SAT.pointInCircle(new Vector(m.x, m.y), playerCircle)){
            if (m.id == currentPlayer.id && m.speed > 0 && z == m.num) return false;
            if (currentCell.mass > m.masa * 1.1) return true;
        }

        return false;
    };

    const check = (user, currentCell, playerCollisions) => {
        for (let i = 0; i < user.cells.length; i++) {
            if (user.cells[i].mass >= 10 && user.id !== currentPlayer.id) {
                const response = new SAT.Response();
                const hasCollided = SAT.testCircleCircle(playerCircle,
                    new Circle(new Vector(user.cells[i].x, user.cells[i].y), user.cells[i].radius),
                    response);

                if (hasCollided) {
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
    };

    const collisionCheck = (collision) => {
        if (collision.aUser.mass > collision.bUser.mass * 1.1  && collision.aUser.radius > Math.sqrt(Math.pow(collision.aUser.x - collision.bUser.x, 2) + Math.pow(collision.aUser.y - collision.bUser.y, 2))*1.75) {
            console.log('[DEBUG] Killing user: ' + collision.bUser.id);
            console.log('[DEBUG] Collision info:');
            console.log(collision);

            const userIndex = util.findIndex(users, collision.bUser.id);
            if (userIndex > -1) {
                if(users[userIndex].cells.length > 1) {
                    users[userIndex].massTotal -= collision.bUser.mass;
                    users[userIndex].cells.splice(collision.bUser.num, 1);
                } else {
                    users.splice(userIndex, 1);
                    io.emit('playerDied', { 
                        playerEatenName: collision.bUser.name,
                        // TODO: Implement aUser name.
                        //playerWhoAtePlayerName: collision.aUser.name,
                    });
                    sockets[collision.bUser.id].emit('RIP');
                }
            }
            currentPlayer.massTotal += collision.bUser.mass;
            collision.aUser.mass += collision.bUser.mass;
        }
    };

    for (let i = 0; i < currentPlayer.cells.length; i++) {
        const currentCell = currentPlayer.cells[i];

        playerCircle = new Circle(
            new Vector(currentCell.x, currentCell.y),
            currentCell.radius
        );

        const foodEaten = food.map(funcFood)
            .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

        foodEaten.forEach(deleteFood);

        const massEaten = massFood.map((f) => eatMass(f, currentCell))
            .reduce(function(a, b, c) {return b ? a.concat(c) : a; }, []);

        const virusCollision = viruses.map(funcFood)
           .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

        if (virusCollision > 0 && currentCell.mass > viruses[virusCollision].mass) {
          sockets[currentPlayer.id].emit('virusSplit', i);
          viruses.splice(virusCollision, 1);
        }

        let masaGanada = 0;
        for (let i = 0; i < massEaten.length; i++) {
            masaGanada += massFood[massEaten[i]].masa;
            massFood[massEaten[i]] = {};
            massFood.splice(massEaten[i],1);
            for(var j = 0; j < massEaten.length; j++) {
                if(massEaten[i] < massEaten[j]) {
                    massEaten[j]--;
                }
            }
        }

        if (typeof(currentCell.speed) == "undefined") {
            currentCell.speed = 6.25;
        }

        masaGanada += (foodEaten.length * config.foodMass);
        currentCell.mass += masaGanada;
        currentPlayer.massTotal += masaGanada;
        currentCell.radius = util.massToRadius(currentCell.mass);
        playerCircle.r = currentCell.radius;

        tree.clear();
        users.forEach(tree.put);
        let playerCollisions = [];

        tree.get(currentPlayer, (u) => check(u, currentCell, playerCollisions));

        playerCollisions.forEach(collisionCheck);
    }
};

const moveloop = () => {
    for (let i = 0; i < users.length; i++) {
        tickPlayer(users[i]);
    }
    for (let i = 0; i < massFood.length; i++) {
        if(massFood[i].speed > 0) {
            playerLogic.moveMass(massFood[i]);
        }
    }
};

const gameloop = () => {
    if (users.length > 0) {
        users.sort((a, b) => { 
            return b.massTotal - a.massTotal; 
        });

        const topUsers = [];

        for (let i = 0; i < Math.min(10, users.length); i++) {
            if (users[i].type == 'player') {
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
            for (let i = 0; i < leaderboard.length; i++) {
                if (leaderboard[i].id !== topUsers[i].id) {
                    leaderboard = topUsers;
                    leaderboardChanged = true;
                    break;
                }
            }
        }

        for (let i = 0; i < users.length; i++) {
            for(var j = 0; j < users[i].cells.length; j++) {
                if (users[i].cells[j].mass * (1 - (config.massLossRate / 1000)) > config.defaultPlayerMass && users[i].massTotal > config.minMassLoss) {
                    var massLoss = users[i].cells[j].mass * (1 - (config.massLossRate / 1000));
                    users[i].massTotal -= users[i].cells[j].mass - massLoss;
                    users[i].cells[j].mass = massLoss;
                }
            }
        }
    }

    gameLogic.balanceMass(food, viruses, users);
};

const sendUpdates = () => {
    users.forEach((u) => {
        // center the view if x/y is undefined, this will happen for spectators
        u.x = u.x || config.gameWidth / 2;
        u.y = u.y || config.gameHeight / 2;

        const visibleFood  = food
            .map((f) => {
                if ( f.x > u.x - u.screenWidth/2 - 20 &&
                    f.x < u.x + u.screenWidth/2 + 20 &&
                    f.y > u.y - u.screenHeight/2 - 20 &&
                    f.y < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter((f) => f);

        const visibleVirus = viruses
            .map((f) => {
                if ( f.x > u.x - u.screenWidth/2 - f.radius &&
                    f.x < u.x + u.screenWidth/2 + f.radius &&
                    f.y > u.y - u.screenHeight/2 - f.radius &&
                    f.y < u.y + u.screenHeight/2 + f.radius) {
                    return f;
                }
            })
            .filter((f) => f);

        const visibleMass = massFood
            .map((f) => {
                if (f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
                    f.y-f.radius < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter((f) => f);

        const visibleCells = users
            .map((f) => {
                for (let i = 0; i < f.cells.length; i++)
                {
                    if (f.cells[i].x+f.cells[i].radius > u.x - u.screenWidth/2 - 20 &&
                        f.cells[i].x-f.cells[i].radius < u.x + u.screenWidth/2 + 20 &&
                        f.cells[i].y+f.cells[i].radius > u.y - u.screenHeight/2 - 20 &&
                        f.cells[i].y-f.cells[i].radius < u.y + u.screenHeight/2 + 20) {

                        i = f.cells.lenth;

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
                        } else {
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
            .filter((f) => f);

        sockets[u.id].emit('serverTellPlayerMove', visibleCells, visibleFood, visibleMass, visibleVirus);
        
        if (leaderboardChanged) {
            sockets[u.id].emit('leaderboard', {
                players: users.length,
                leaderboard
            });
        }
    });

    leaderboardChanged = false;
};

setInterval(moveloop, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / config.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
http.listen( serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));
