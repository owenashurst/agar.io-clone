/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');


var c = require('./config.json');

var users = [];
var food = [];
var sockets = {};

var V = SAT.Vector;
var C = SAT.Circle;

Math.log = (function() {
    var log = Math.log;
    return function(n, base) {
        return log(n)/(base ? log(base) : 1);
    };
})();


var initMassLog = Math.log(c.defaultPlayerMass, c.slowBase);

app.use(express.static(__dirname + '/../client'));

function genPos(from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
}

function addFood(toAdd) {
    var radius = massToRadius(c.foodMass);
    while (toAdd--) {
        food.push({
            // make ids unique
            id: ((new Date()).getTime() + '' + (new Date()).getMilliseconds() + '' + food.length) >>> 0,
            x: genPos(radius, c.gameWidth - radius),
            y: genPos(radius, c.gameHeight - radius),
            color: randomColor(),
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

function massToRadius(mass) {
    return Math.sqrt(mass / Math.PI) * 10;
}



function movePlayer(player) {
    var dist = Math.sqrt(Math.pow(player.target.y, 2) + Math.pow(player.target.x, 2));
    var deg = Math.atan2(player.target.y, player.target.x);

    var slowDown = Math.log(player.mass, c.slowBase) - initMassLog + 1;

    var deltaY = player.speed * Math.sin(deg)/ slowDown;
    var deltaX = player.speed * Math.cos(deg)/ slowDown;

    var radius = massToRadius(player.mass);
    if (dist < (50 + radius)) {
        deltaY *= dist / (50 + radius);
        deltaX *= dist / (50 + radius);
    }

    if (!isNaN(deltaY)) {
        player.y += deltaY;
    }
    if (!isNaN(deltaX)) {
        player.x += deltaX;
    }

    var borderCalc = radius / 3;

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

    if (totalMass < c.gameMass) {
        console.log('adding ' + (c.gameMass - totalMass) + ' mass to level');
        addFood(c.gameMass - totalMass);
        console.log('mass rebalanced');
    }
    else if (totalMass > c.gameMass) {
        console.log('removing ' + (totalMass - c.gameMass) + ' mass from level');
        removeFood(totalMass - c.gameMass);
        console.log('mass rebalanced');
    }
}

function validNick(player) {
    var regex = /^\w*$/;
    return regex.exec(player.name) !== null;
}

io.on('connection', function (socket) {
    console.log('A user connected!');

    var currentPlayer = {
        id: socket.id,
        x: genPos(0, c.gameWidth),
        y: genPos(0, c.gameHeight),
        mass: c.defaultPlayerMass,
        hue: Math.round(Math.random() * 360),
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
        } else if (!validNick(player)) {
            socket.emit('kick', 'Invalid username');
            socket.disconnect();
        } else {
            console.log('Player ' + player.id + ' connected!');
            sockets[player.id] = socket;

            player.x = genPos(0, c.gameWidth);
            player.y = genPos(0, c.gameHeight);
            player.mass = c.defaultPlayerMass;
            currentPlayer = player;
            users.push(currentPlayer);

            io.emit('playerJoin', {
                playersList: users,
                connectedName: currentPlayer.name
            });

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

        socket.broadcast.emit('playerDisconnect', {
            playersList: users,
            disconnectName: currentPlayer.name
        });
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
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });
});

function tickPlayer(currentPlayer) {

    movePlayer(currentPlayer);

    var playerCircle = new C(
        new V(currentPlayer.x, currentPlayer.y),
        massToRadius(currentPlayer.mass));

    var foodEaten = food
        .map( function(f) { return SAT.pointInCircle(new V(f.x, f.y), playerCircle); })
        .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

    foodEaten.forEach( function(f) {
        food[f] = {};
        food.splice(f, 1);
    });

    currentPlayer.mass += c.foodMass * foodEaten.length;
    currentPlayer.speed = 10;
    playerCircle.r = massToRadius(currentPlayer.mass);

    var otherUsers = users.filter(function(user) {
        return user.id !== currentPlayer.id;
    });
    var playerCollisions = [];

    otherUsers.forEach(function(user) {
        var response = new SAT.Response();
        var collided = SAT.testCircleCircle(playerCircle,
            new C(new V(user.x, user.y), massToRadius(user.mass)),
            response);

        if (collided) {
            response.aUser = currentPlayer;
            response.bUser = user;
            playerCollisions.push(response);
        }
    });

    playerCollisions.forEach(function(collision) {
        if (collision.aUser.mass > collision.bUser.mass * 1.1 && massToRadius(collision.aUser.mass) > Math.sqrt(Math.pow(collision.aUser.x - collision.bUser.x, 2) + Math.pow(collision.aUser.y - collision.bUser.y, 2))) {
            console.log('KILLING USER: ' + collision.bUser.id);
            console.log('collision info:');
            console.log(collision);

            if (findIndex(users, collision.aUser.id) > -1)
                users.splice(findIndex(users, collision.bUser.id), 1);

            io.emit('playerDied', {
                playersList: users,
                disconnectName: collision.bUser.name
            });

            collision.aUser.mass += collision.bUser.mass;
            sockets[collision.bUser.id].emit('RIP');
        }
        else if (collision.bUser.mass > collision.aUser.mass * 1.1 && massToRadius(collision.bUser.mass) > Math.sqrt(Math.pow(collision.bUser.x - collision.aUser.x, 2) + Math.pow(collision.bUser.y - collision.aUser.y, 2))) {
            console.log('KILLING USER: ' + collision.aUser.id);
            console.log('collision info:');
            console.log(collision);

            if (findIndex(users, collision.aUser.id) > -1)
                users.splice(findIndex(users, collision.aUser.id), 1);

            io.emit('playerDied', {
                playersList: users,
                disconnectName: collision.aUser.name
            });

            collision.bUser.mass += collision.aUser.mass;
            sockets[collision.aUser.id].emit('RIP');
        }
    });

    var visibleFood  = food
        .map(function(f) {
            if ( f.x > currentPlayer.x - currentPlayer.screenWidth/2 - 20 &&
                f.x < currentPlayer.x + currentPlayer.screenWidth/2 + 20 &&
                f.y > currentPlayer.y - currentPlayer.screenHeight/2 - 20 &&
                f.y < currentPlayer.y + currentPlayer.screenHeight/2 + 20) {
            return f;
            }
        })
        .filter(function(f) { return f; });

    sockets[currentPlayer.id].emit('serverTellPlayerMove', currentPlayer, users, visibleFood);
}

function gameloop() {

    for(var i = 0; i < users.length; i++)
        tickPlayer(users[i]);

    // rebalance mass
    balanceMass();
    setTimeout(gameloop, 1000/50);
}

gameloop();

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
