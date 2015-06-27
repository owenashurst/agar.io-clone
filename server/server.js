/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');

var c = require('./config.json'),

    // import utilities
    util = require('./lib/util');

var users = [];
var food = [];
var sockets = {};

var leaderboard = [];
var leaderboardChanged = false;

var V = SAT.Vector;
var C = SAT.Circle;

var initMassLog = util.log(c.defaultPlayerMass, c.slowBase);

app.use(express.static(__dirname + '/../client'));

function addFood(toAdd) {
    var radius = util.massToRadius(c.foodMass);
    while (toAdd--) {
        var position = c.foodUniformDisposition ? util.uniformPosition(food, radius) : util.randomPosition(radius);

        food.push({
            // make ids unique
            id: ((new Date()).getTime() + '' + food.length) >>> 0,
            x: position.x,
            y: position.y,
            radius: radius,
            mass: Math.random() + 2,
            color: randomColor()
        });
    }
}

function removeFood(toRem) {
    while (toRem--) {
        food.pop();
    }
}

function findIndex(arr, id) {
    var len = arr.length;

    while (len--) {
        if (arr[len].id === id) {
            return len;
        }
    }

    return -1;
}

function randomColor() {
    var color = '#' + ('00000' + (Math.random() * (1 << 24) | 0).toString(16)).slice(-6);
    var c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    var r = (parseInt(c[1], 16) - 32) > 0 ? (parseInt(c[1], 16) - 32) : 0;
    var g = (parseInt(c[2], 16) - 32) > 0 ? (parseInt(c[2], 16) - 32) : 0;
    var b = (parseInt(c[3], 16) - 32) > 0 ? (parseInt(c[3], 16) - 32) : 0;

    return {
        fill: color,
        border: '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
    };
}

// implement player movement in the direction of the target
function movePlayer(player) {
    var dist = Math.sqrt(Math.pow(player.target.y, 2) + Math.pow(player.target.x, 2));
    var deg = Math.atan2(player.target.y, player.target.x);

    var slowDown = util.log(player.mass, c.slowBase) - initMassLog + 1;

    var deltaY = player.speed * Math.sin(deg)/ slowDown;
    var deltaX = player.speed * Math.cos(deg)/ slowDown;

    if (dist < (50 + player.radius)) {
        deltaY *= dist / (50 + player.radius);
        deltaX *= dist / (50 + player.radius);
    }

    if (!isNaN(deltaY)) {
        player.y += deltaY;
    }
    if (!isNaN(deltaX)) {
        player.x += deltaX;
    }

    var borderCalc = player.radius / 3;

    if (player.x > c.gameWidth - borderCalc) {
        player.x = c.gameWidth - borderCalc;
    }
    if (player.y > c.gameHeight - borderCalc) {
        player.y = c.gameHeight - borderCalc;
    }
    if (player.x < borderCalc) {
        player.x = borderCalc;
    }
    if (player.y < borderCalc) {
        player.y = borderCalc;
    }
}

function balanceMass() {
    var totalMass = food.length * c.foodMass +
        users
            .map(function(u) {return u.mass; })
            .reduce(function(pu,cu) { return pu+cu;}, 0);

    var massDiff = c.gameMass - totalMass;
    var maxFoodDiff = c.maxFood - food.length;
    var foodDiff = parseInt(massDiff / c.foodMass) - maxFoodDiff;
    var foodToAdd = Math.min(foodDiff, maxFoodDiff);
    var foodToRemove = -Math.max(foodDiff, maxFoodDiff);

    if (foodToAdd > 0) {
        console.log('adding ' + foodToAdd + ' food to level');
        addFood(foodToAdd);
        console.log('mass rebalanced');
    }
    else if (foodToRemove > 0) {
        console.log('removing ' + foodToRemove + ' food from level');
        removeFood(foodToRemove);
        console.log('mass rebalanced');
    }
}

io.on('connection', function (socket) {
    console.log('A user connected!');

    var radius = util.massToRadius(c.defaultPlayerMass);
    var position = c.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

    var currentPlayer = {
        id: socket.id,
        x: position.x,
        y: position.y,
        radius: radius,
        mass: c.defaultPlayerMass,
        hue: Math.round(Math.random() * 360),
        lastHeartbeat: new Date().getTime(),
        target: {
            x: 0,
            y: 0
        }
    };

    socket.on('gotit', function (player) {
        console.log('Player ' + player.id + ' connecting');

        if (findIndex(users, player.id) > -1) {
            console.log('That playerID is already connected, kicking');
            socket.disconnect();
        } else if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username');
            socket.disconnect();
        } else {
            console.log('Player ' + player.id + ' connected!');
            sockets[player.id] = socket;

            var radius = util.massToRadius(c.defaultPlayerMass);
            var position = c.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

            player.x = position.x;
            player.y = position.y;
            player.target.x = player.x;
            player.target.y = player.y;
            player.mass = c.defaultPlayerMass;
            player.radius = radius;
            currentPlayer = player;
            currentPlayer.lastHeartbeat = new Date().getTime();
            users.push(currentPlayer);

            io.emit('playerJoin', { name: currentPlayer.name });

            socket.emit('gameSetup', {
                gameWidth: c.gameWidth,
                gameHeight: c.gameHeight
            });
            console.log('Total player: ' + users.length);
        }

    });

    socket.on('ping', function () {
        socket.emit('pong');
    });

    socket.on('windowResized', function (data) {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', function () {
        if (findIndex(users, currentPlayer.id) > -1)
            users.splice(findIndex(users, currentPlayer.id), 1);
        socket.emit('welcome', currentPlayer);
        console.log('User #' + currentPlayer.id + ' respawned');
    });

    socket.on('disconnect', function () {
        if (findIndex(users, currentPlayer.id) > -1)
            users.splice(findIndex(users, currentPlayer.id), 1);
        console.log('User #' + currentPlayer.id + ' disconnected');

        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        if (c.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message});
    });

    socket.on('pass', function(data) {
        if (data[0] === c.adminPass) {
            console.log(currentPlayer.name + ' just logged in as an admin');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as admin!');
            currentPlayer.admin = true;
        } else {
            console.log(currentPlayer.name + ' sent incorrect admin password');
            socket.emit('serverMSG', 'Password incorrect attempt logged.');
            // TODO actually log incorrect passwords
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
                       console.log('User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
                    }
                    else {
                       console.log('User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name);
                    }
                    socket.emit('serverMSG', 'User ' + users[e].name + ' was kicked by ' + currentPlayer.name);
                    sockets[users[e].id].emit('kick', reason);
                    sockets[users[e].id].disconnect();
                    users.splice(e, 1);
                    worked = true;
                }
            }
            if (!worked) {
                socket.emit('serverMSG', 'Could not find user or user is admin');
            }
        } else {
            console.log(currentPlayer.name + ' is trying to use -kick but isn\'t admin');
            socket.emit('serverMSG', 'You are not permitted to use this command');
        }
    });

    // Heartbeat function, update everytime
    socket.on('0', function(target) {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });
});

function tickPlayer(currentPlayer) {

    if(currentPlayer.lastHeartbeat < new Date().getTime() - c.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + c.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }

    movePlayer(currentPlayer);

    var playerCircle = new C(
        new V(currentPlayer.x, currentPlayer.y),
        currentPlayer.radius
    );

    var foodEaten = food
        .map( function(f) { return SAT.pointInCircle(new V(f.x, f.y), playerCircle); })
        .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

    foodEaten.forEach( function(f) {
        food[f] = {};
        food.splice(f, 1);
    });

    currentPlayer.speed = 6.25;
    currentPlayer.mass += foodEaten.length * c.foodMass;
    currentPlayer.radius = util.massToRadius(currentPlayer.mass);
    playerCircle.r = currentPlayer.radius;

    var otherUsers = users.filter(function(user) {
        return user.id !== currentPlayer.id;
    });
    var playerCollisions = [];

    otherUsers.forEach(function(user) {
        var response = new SAT.Response();
        var collided = SAT.testCircleCircle(playerCircle,
            new C(new V(user.x, user.y), user.radius),
            response);

        if (collided) {
            response.aUser = currentPlayer;
            response.bUser = user;
            playerCollisions.push(response);
        }
    });

    playerCollisions.forEach(function(collision) {
        if (collision.aUser.mass > collision.bUser.mass * 1.1) {
            console.log('KILLING USER: ' + collision.bUser.id);
            console.log('collision info:');
            console.log(collision);

            if (findIndex(users, collision.aUser.id) > -1)
                users.splice(findIndex(users, collision.bUser.id), 1);

            io.emit('playerDied', { name: collision.bUser.name });

            collision.aUser.mass += collision.bUser.mass;
            sockets[collision.bUser.id].emit('RIP');
        }
        else if (collision.bUser.mass > collision.aUser.mass * 1.1) {
            console.log('KILLING USER: ' + collision.aUser.id);
            console.log('collision info:');
            console.log(collision);

            if (findIndex(users, collision.aUser.id) > -1)
                users.splice(findIndex(users, collision.aUser.id), 1);

            io.emit('playerDied', { name: collision.aUser.name });

            collision.bUser.mass += collision.aUser.mass;
            sockets[collision.aUser.id].emit('RIP');
        }
    });
}

function moveloop() {
    for (var i = 0; i < users.length; i++) {
        tickPlayer(users[i]);
    }
}

function gameloop() {
    if (users.length > 0) {
        users.sort( function(a, b) { return b.mass - a.mass; });

        var topUsers = [];

        for (var i = 0; i < Math.min(10, users.length); i++) {
            topUsers.push({
                id: users[i].id,
                name: users[i].name
            });
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
            if (users[i].mass >= 10){
            users[i].mass = users[i].mass * (1 - (c.massLossRate / 1000));
            }
        }
    }
    balanceMass();
}

function sendUpdates() {
    users.forEach( function(u) {
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

        var visibleEnemies  = users
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - 20 &&
                    f.x < u.x + u.screenWidth/2 + 20 &&
                    f.y > u.y - u.screenHeight/2 - 20 &&
                    f.y < u.y + u.screenHeight/2 + 20 &&
                    f.id !== u.id) {
                    return {
                        id: f.id,
                        x: f.x,
                        y: f.y,
                        mass: Math.round(f.mass),
                        radius: Math.round(f.radius),
                        hue: f.hue,
                        name: f.name
                    };
                }
            })
            .filter(function(f) { return f; });

        sockets[u.id].emit('serverTellPlayerMove', {
            x: u.x,
            y: u.y,
            radius: Math.round(u.radius),
            mass: Math.round(u.mass)
        }, visibleEnemies, visibleFood);
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

// Don't touch on ip
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || c.port;
if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
    http.listen( serverport, ipaddress, function() {
        console.log('listening on *:' + serverport);
    });
} else {
    http.listen( serverport, function() {
        console.log('listening on *:' + c.port);
    });
}
