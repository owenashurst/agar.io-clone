/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');

// Import game settings.
var c = require('../../config.json');

// Import utilities.
var util = require('./lib/util');

// Import quadtree.
var quadtree = require('simple-quadtree');

var tree = quadtree(0, 0, c.gameWidth, c.gameHeight);

var users = [];
var massFood = [];
var food = [];
var virus = [];
var sockets = {};

var leaderboard = [];
var leaderboardChanged = false;

var V = SAT.Vector;
var C = SAT.Circle;

var initMassLog = util.log(c.defaultPlayerMass, c.slowBase);

// If hunger games, need to wait for the number of players
var shouldRun = c.gameMode !== 'robot';
var startTime = shouldRun? new Date().getTime() : undefined;
var gameStatus = {
    mode: c.gameMode,
    running: shouldRun,
    startTime: startTime,
    timeLimit: c.robotModeConf.timeLimit * 1000, // seconds to miliseconds
    maxPlayers: c.robotModeConf.maxPlayers,
    maxMass: c.robotModeConf.maxMass,
    players: 0,
    spectators: 0,
    lastWinner: undefined,
    finishReason: undefined
};

app.use(express.static(__dirname + '/../client'));

function addFood(toAdd) {
    var radius = util.massToRadius(c.foodMass);
    while (toAdd--) {
        var position = c.foodUniformDisposition ? util.uniformPosition(food, radius) : util.randomPosition(radius);
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

function addVirus(toAdd) {
    while (toAdd--) {
        var mass = util.randomInRange(c.virus.defaultMass.from, c.virus.defaultMass.to, true);
        var radius = util.massToRadius(mass);
        var position = c.virusUniformDisposition ? util.uniformPosition(virus, radius) : util.randomPosition(radius);
        virus.push({
            id: ((new Date()).getTime() + '' + virus.length) >>> 0,
            x: position.x,
            y: position.y,
            radius: radius,
            mass: mass,
            fill: c.virus.fill,
            stroke: c.virus.stroke,
            strokeWidth: c.virus.strokeWidth
        });
    }
}

function removeFood(toRem) {
    while (toRem--) {
        food.pop();
    }
}

function movePlayer(player) {
    var x=0,y=0;
    for(var i=0; i<player.cells.length; i++)
    {
        var target = {
            x: player.x - player.cells[i].x + player.target.x,
            y: player.y - player.cells[i].y + player.target.y
        };
        var dist = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
        var deg = Math.atan2(target.y, target.x);
        var slowDown = 1;
        if(player.cells[i].speed > c.defaultSpeed) {
            player.cells[i].speed -= c.slowdown;
        } else {
            // Since split cell - n*desacceleration might not equal to c.defaultSpeed,
            // we have to make sure the cell wont have less than the default speed
            // (before calculating the slow speed from having more mass than 10).
            player.cells[i].speed = c.defaultSpeed;
        }
        if(player.cells[i].speed <= c.defaultSpeed) {
            slowDown = util.log(player.cells[i].mass, c.slowBase) - initMassLog + 1;
        }

        var deltaY = player.cells[i].speed * Math.sin(deg) / slowDown;
        var deltaX = player.cells[i].speed * Math.cos(deg) / slowDown;

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
        for(var j=0; j<player.cells.length; j++) {
            if(j != i && player.cells[i] !== undefined) {
                var distance = Math.sqrt(Math.pow(player.cells[j].y-player.cells[i].y,2) + Math.pow(player.cells[j].x-player.cells[i].x,2));
                var radiusTotal = (player.cells[i].radius + player.cells[j].radius);
                if(distance < radiusTotal) {
                    if(player.lastSplit > new Date().getTime() - 1000 * c.mergeTimer) {
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
                    else if(distance < radiusTotal / 1.75) {
                        player.cells[i].mass += player.cells[j].mass;
                        player.cells[i].radius = util.massToRadius(player.cells[i].mass);
                        player.cells.splice(j, 1);
                    }
                }
            }
        }
        if(player.cells.length > i) {
            var borderCalc = player.cells[i].radius / 3;
            if (player.cells[i].x > c.gameWidth - borderCalc) {
                player.cells[i].x = c.gameWidth - borderCalc;
            }
            if (player.cells[i].y > c.gameHeight - borderCalc) {
                player.cells[i].y = c.gameHeight - borderCalc;
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
}

function moveMass(mass) {
    var deg = Math.atan2(mass.target.y, mass.target.x);
    var deltaY = mass.speed * Math.sin(deg);
    var deltaX = mass.speed * Math.cos(deg);

    mass.speed -= c.slowdown;
    if(mass.speed < 0) {
        mass.speed = 0;
    }
    if (!isNaN(deltaY)) {
        mass.y += deltaY;
    }
    if (!isNaN(deltaX)) {
        mass.x += deltaX;
    }

    var borderCalc = mass.radius + 5;

    if (mass.x > c.gameWidth - borderCalc) {
        mass.x = c.gameWidth - borderCalc;
    }
    if (mass.y > c.gameHeight - borderCalc) {
        mass.y = c.gameHeight - borderCalc;
    }
    if (mass.x < borderCalc) {
        mass.x = borderCalc;
    }
    if (mass.y < borderCalc) {
        mass.y = borderCalc;
    }
}

function balanceMass() {
    var totalMass = food.length * c.foodMass +
        users
            .map(function(u) {return u.massTotal; })
            .reduce(function(pu,cu) { return pu+cu;}, 0);

    var massDiff = c.gameMass - totalMass;
    var maxFoodDiff = c.maxFood - food.length;
    var foodDiff = parseInt(massDiff / c.foodMass) - maxFoodDiff;
    var foodToAdd = Math.min(foodDiff, maxFoodDiff);
    var foodToRemove = -Math.max(foodDiff, maxFoodDiff);

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

    var virusToAdd = c.maxVirus - virus.length;

    if (virusToAdd > 0) {
        addVirus(virusToAdd);
    }
}

io.on('connection', function (socket) {
    console.log('A user connected!', socket.handshake.query.type);

    var type = socket.handshake.query.type;
    var radius = util.massToRadius(c.defaultPlayerMass);
    var position = c.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

    var cells = [];
    var massTotal = 0;
    if(type === 'player') {
        cells = [{
            mass: c.defaultPlayerMass,
            x: position.x,
            y: position.y,
            radius: radius
        }];
        massTotal = c.defaultPlayerMass;
    }

    var currentPlayer = {
        id: socket.id,
        x: position.x,
        y: position.y,
        w: c.defaultPlayerMass,
        h: c.defaultPlayerMass,
        points: 0,
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
        } else if (gameStatus.mode == 'robot' && type === 'player' && gameStatus.running) {
            // TODO: for now players entering an ongoing hunger games game are
            // kicked. The right find would be to let them enter a pool and wait
            // for the next game.
            socket.emit('kick', 'Wait the next game.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + player.name + ' connected!');
            sockets[player.id] = socket;

            var radius = util.massToRadius(c.defaultPlayerMass);
            var position = c.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

            player.x = position.x;
            player.y = position.y;
            player.target.x = 0;
            player.target.y = 0;
            if(type === 'player') {
                player.cells = [{
                    mass: c.defaultPlayerMass,
                    x: position.x,
                    y: position.y,
                    radius: radius
                }];
                player.massTotal = c.defaultPlayerMass;
                gameStatus.players += 1;
            }
            else {
                gameStatus.spectators += 1;
                player.cells = [];
                player.massTotal = 0;
            }
            player.hue = Math.round(Math.random() * 360);
            currentPlayer = player;
            currentPlayer.points = 0;
            currentPlayer.lastHeartbeat = new Date().getTime();
            users.push(currentPlayer);

            io.emit('playerJoin', { name: currentPlayer.name });

            socket.emit('gameSetup', {
                gameWidth: c.gameWidth,
                gameHeight: c.gameHeight,
                gameMode: c.gameMode
            });

            // start game if we have enough players
            if (gameStatus.mode == 'robot' && gameStatus.players == gameStatus.maxPlayers) {
                startGame();
            }

            console.log('Total players: ' + users.length);
        }

    });

    socket.on('marco', function () {
        socket.emit('polo');
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

        if (currentPlayer.type === 'player') {
            gameStatus.players -= 1;
        } else {
            gameStatus.spectators -= 1;
        }

        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        if (c.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0,35)});
    });

    socket.on('pass', function(data) {
        if (data[0] === c.adminPass) {
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

    socket.on('kick', function(data) {
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
                    if (currentPlayer.type === 'player') {
                        gameStatus.players -= 1;
                    } else {
                        gameStatus.spectators -= 1;
                    }
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

        if (gameStatus.running && (target.x !== currentPlayer.x || target.y !== currentPlayer.y)) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function() {
        // Fire food.
        for(var i=0; i<currentPlayer.cells.length; i++)
        {
            if(((currentPlayer.cells[i].mass >= c.defaultPlayerMass + c.fireFood) && c.fireFood > 0) || (currentPlayer.cells[i].mass >= 20 && c.fireFood === 0)){
                var masa = 1;
                if(c.fireFood > 0)
                    masa = c.fireFood;
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
            cell.mass = cell.mass/2;
            cell.radius = util.massToRadius(cell.mass);
            currentPlayer.cells.push({
                mass: cell.mass,
                x: cell.x,
                y: cell.y,
                radius: cell.radius,
                speed: c.splitSpeed
            });
            currentPlayer.lastSplit = new Date().getTime();
        }

        if (currentPlayer.cells.length < c.limitSplit) {
            // Split all cells when colide with virus
            if (virusCell !== undefined) {
                for (var c_idx=0; c_idx < currentPlayer.cells.length; c_idx++) {
                    var cell = currentPlayer.cells[c_idx];
                    if (cell.mass > c.limitSplit) {
                        splitCell(cell);
                    }
                }
            }
            //Split all cells (user split command)
            else {
                var numMax = currentPlayer.cells.length;
                for(var d=0; d<numMax; d++) {
                    if(currentPlayer.cells[d].mass >= c.defaultPlayerMass*2) {
                        splitCell(currentPlayer.cells[d]);
                    }
                }
            }
        }
    });
});

function startGame() {
    gameStatus.lastWinner = false;
    gameStatus.running = true;
    gameStatus.startTime = new Date().getTime();
}

function finishGame(reason) {
    console.log('finish', reason);
    sortUsersByPoints();
    gameStatus.lastWinner = users[0];
    gameStatus.running = false;
    gameStatus.startTime = undefined;
    gameStatus.finishReason = reason;
}

function checkEnd() {

    if (gameStatus.mode === 'robot' && gameStatus.running) {
        // time is over?
        var elapsed = new Date().getTime() - gameStatus.startTime;
        if (gameStatus.timeLimit > 0 && elapsed >= gameStatus.timeLimit) {
            finishGame('time-limit');
        // do we have a winner?
    } else if (gameStatus.players == 1) {
            finishGame('winner');
        }
    } else {
        return false;
    }
}

function tickPlayer(currentPlayer) {
    if(currentPlayer.lastHeartbeat < new Date().getTime() - c.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + c.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }

    movePlayer(currentPlayer);

    function funcFood(f) {
        return SAT.pointInCircle(new V(f.x, f.y), playerCircle);
    }

    function deleteFood(f) {
        food[f] = {};
        food.splice(f, 1);
    }

    function eatMass(m) {
        if(SAT.pointInCircle(new V(m.x, m.y), playerCircle)){
            if(m.id == currentPlayer.id && m.speed > 0 && z == m.num)
                return false;
            if(currentCell.mass > m.masa * 1.1)
                return true;
        }
        return false;
    }

    function check(params) {
        var user = params.user;
        var cell = params.cell;

        if (user.id === currentPlayer.id) {
            return true;
        }

        if(cell.mass > c.defaultPlayerMass) {
            var response = new SAT.Response();
            var vector = new V(cell.x, cell.y);
            var circle = new C(vector, cell.radius);
            var collided = SAT.testCircleCircle(playerCircle, circle, response);
            var i = params.index;
            if (collided) {
                response.aUser = currentCell;
                response.aUser.id = currentPlayer.id;
                response.bUser = {
                    num: i,
                    id: user.id,
                    name: user.name,
                    x: cell.x,
                    y: cell.y,
                    mass: cell.mass,
                    radius: cell.radius
                };
                playerCollisions.push(response);
            }
        }

        return true;
    }

    function collisionCheck(collision) {

        var aUser = collision.aUser;
        var bUser = collision.bUser;
        var distance = util.distance(aUser, bUser);
        var swapped = false;
        if (aUser.mass < bUser.mass) {
            var auxUser = aUser;
            aUser = bUser;
            bUser = auxUser;
            swapped = true;
        }

        if (aUser.mass > bUser.mass * 1.1 && aUser.radius > distance) {
            console.log('[DEBUG] Killing user: ' + bUser.id);
            console.log('[DEBUG] Collision info:');
            console.log(collision);

            var numUserB = util.findIndex(users, bUser.id);
            if (numUserB > -1) {
                if(users[numUserB].cells.length > 1) {
                    users[numUserB].massTotal -= bUser.mass;
                    users[numUserB].cells.splice(bUser.num, 1);
                } else {
                    users.splice(numUserB, 1);
                    io.emit('playerDied', { name: bUser.name });
                    gameStatus.players -= 1;
                    sockets[bUser.id].emit('RIP');
                }
            }

            var numUserA = util.findIndex(users, aUser.id);
            if (numUserA > -1) {
                users[numUserA].massTotal += bUser.mass;
            }

            // If aUser and bUser were swapped, we cant just increment aUser mass, because its a
            // new object (not a reference to the cell) and will not update the game correctly.
            var eaterCell = (swapped) ? users[numUserA].cells[aUser.num] : aUser;
            eaterCell.mass += bUser.mass;
            checkPoint(aUser);
            checkPoint(bUser);

        }
    }

    function forEachCell(user) {
        var length = user.cells.length;

        for (var i=0; i<length; ++i) {
            var cell = user.cells[i];
            tree.put({
                x: cell.x - cell.radius,
                y: cell.y - cell.radius,
                w: cell.radius * 2,
                h: cell.radius * 2,
                user: user,
                cell: cell,
                index: i
            });
        }
    }

    for(var z=0; z<currentPlayer.cells.length; z++) {
        var currentCell = currentPlayer.cells[z];
        var playerCircle = new C(
            new V(currentCell.x, currentCell.y),
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
            currentCell.speed = c.defaultSpeed;
        masaGanada += (foodEaten.length * c.foodMass);
        currentCell.mass += masaGanada;
        currentPlayer.massTotal += masaGanada;
        checkPoint(currentPlayer);
        currentCell.radius = util.massToRadius(currentCell.mass);
        playerCircle.r = currentCell.radius;

        tree.clear();

        users.forEach(forEachCell);

        var playerCollisions = [];
        var otherUsers = tree.get(currentPlayer, check);
        playerCollisions.forEach(collisionCheck);
    }
}

function checkPoint(player) {
    if (gameStatus.mode === 'robot' && player.massTotal >= gameStatus.maxMass) {

        player.cells = [{
            mass: c.defaultPlayerMass,
            x: player.x,
            y: player.y,
            radius: util.massToRadius(c.defaultPlayerMass)
        }];

        player.massTotal = c.defaultPlayerMass;

        player.points += 1;

    }

    return true;
}

function moveloop() {

    if (!gameStatus.running) {
        return;
    }

    for (var i = 0; i < users.length; i++) {
        tickPlayer(users[i]);
    }

    checkEnd();

    for (i=0; i < massFood.length; i++) {
        if(massFood[i].speed > 0) moveMass(massFood[i]);
    }
}

function sortUsersByPoints() {
    var score_attr;
    if (gameStatus.mode === 'robot') {
        score_attr = 'points';
        users.sort( function(a, b) { return b.points - a.points; });
    } else {
        score_attr = 'massTotal';
        users.sort( function(a, b) { return b.massTotal - a.massTotal; });
    }
    return score_attr;
}

function gameloop() {

    // in hunger games mode show leaderboard as the number of missing players
    if (!gameStatus.running) {

        leaderboard = [];

        var players = gameStatus.players;
        var maxPlayers = gameStatus.maxPlayers;
        var msg = 'Waiting for players: ' + players + '/' + maxPlayers;

        if (gameStatus.lastWinner) {
            leaderboard.push({
                id: null,
                name: 'WINNER: ' + gameStatus.lastWinner.name,
                score: ''
            });
        }

        leaderboard.push({
            id: null,
            name: msg,
            score: ''
        });

        leaderboardChanged = true;
    } else if (users.length > 0) {
        var score_attr = sortUsersByPoints();

        var topUsers = [];

        for (var i = 0; i < Math.min(10, users.length); i++) {
            if (users[i].type == 'player') {
                topUsers.push({
                    id: users[i].id,
                    name: users[i].name,
                    score: Math.round(users[i][score_attr])
                });
            }
        }

        if (isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
            leaderboard = topUsers;
            leaderboardChanged = true;
        } else {
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
                if (users[i].cells[z].mass * (1 - (c.massLossRate / 1000)) > c.defaultPlayerMass && users[i].massTotal > c.minMassLoss) {
                    var massLoss = users[i].cells[z].mass * (1 - (c.massLossRate / 1000));
                    users[i].massTotal -= users[i].cells[z].mass - massLoss;
                    users[i].cells[z].mass = massLoss;
                }
            }
        }
        balanceMass();
    }
}

function sendUpdates() {
    users.forEach( function(u) {
        // center the view if x/y is undefined, this will happen for spectators
        u.x = u.x || c.gameWidth / 2;
        u.y = u.y || c.gameHeight / 2;

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

        var visibleCells = users
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
setInterval(sendUpdates, 1000 / c.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || c.port;
if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
    http.listen( serverport, ipaddress, function() {
        console.log('[DEBUG] Listening on *:' + serverport);
    });
} else {
    http.listen( serverport, function() {
        console.log('[DEBUG] Listening on *:' + c.port);
    });
}
