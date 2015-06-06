'use strict';

var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var SAT = require('sat');

var c = require('./config.json');

var users = [];
var food = [];
var sockets = {};

var V = SAT.Vector;
var C = SAT.Circle;

app.use(express.static(__dirname + '/../client'));

function genPos(from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
}

function addFood(toAdd) {
    while(toAdd--){
        food.push({
            // make ids unique
            id: ((new Date()).getTime() + '' + (new Date()).getMilliseconds() + '' + food.length) >>> 0,
            x: genPos(0, c.gameWidth),
            y: genPos(0, c.gameHeight),
            color: randomColor(),
        });
    }
}

function removeFood(toRem){
    while(toRem--) food.pop();
}

function balanceMass(){    
    var totalMass = food.length * c.foodMass +
        users.map(function(u){ return u.mass; })
        .reduce(function(pu,cu){ return pu+cu;});
    
    if(totalMass < c.gameMass) {
        addFood(c.gameMass - totalMass);
        console.log('mass rebalanced');
    }
    else if(totalMass > c.gameMass){
        removeFood(totalMass - c.gameMass);
        console.log('mass rebalanced');
    }
}

// arr is for example users or food
// http://jsperf.com/while-vs-map-findindex/2
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

function findPlayer(id) {
    var index = findIndex(users, id);

    return index !== -1 ? users[index] : null;
}

function removePlayer(id) {
    users.splice(findIndex(users, id), 1);
}

function hitTest(start, end, min) {
    var distance = Math.sqrt((start.x - end.x) * (start.x - end.x) + (start.y - end.y) * (start.y - end.y));
    return (distance <= min);
}

function movePlayer(player, target) {
    var dist = Math.sqrt(Math.pow(target.y - player.screenHeight / 2, 2) + Math.pow(target.x - player.screenWidth / 2, 2)),
       deg = Math.atan2(target.y - player.screenHeight / 2, target.x - player.screenWidth / 2);

    //Slows player as mass increases.
    var slowDown = ((player.mass + 1)/17) + 1;

    var deltaY = player.speed * Math.sin(deg)/ slowDown;
    var deltaX = player.speed * Math.cos(deg)/ slowDown;

    if (dist < (100 + c.defaultPlayerSize + player.mass)) {
        deltaY *= dist / (100 + c.defaultPlayerSize + player.mass);
        deltaX *= dist / (100 + c.defaultPlayerSize + player.mass);
    }

    var borderCalc = c.defaultPlayerSize + player.mass - 15;

    player.y += (player.y + deltaY >= borderCalc && player.y + deltaY <= player.gameHeight - borderCalc) ? deltaY : 0;
    player.x += (player.x + deltaX >= borderCalc && player.x + deltaX <= player.gameWidth - borderCalc) ? deltaX : 0;
}


io.on('connection', function (socket) {
    console.log('A user connected!');

    var currentPlayer = {
        id: socket.id,
        x: genPos(0, c.gameWidth),
        y: genPos(0, c.gameHeight),
        mass: c.defaultPlayerMass,        
        hue: Math.round(Math.random() * 360),
    };
    
    socket.emit('welcome', currentPlayer);

    socket.on('gotit', function (player) {
        console.log('Player ' + player.id + ' connecting');

        if(sockets[player.id]){
            console.log('That playerID is already connected, kicking');
            socket.disconnect();
        }
        else {
            console.log('Player ' + player.id + ' connected!');
            sockets[player.id] = socket;
            currentPlayer = player;
            users.push(currentPlayer);
            io.emit('playerJoin', {
                playersList: users, 
                connectedName: currentPlayer.name});
            socket.emit('gameSetup', c);
            console.log('Total player: ' + users.length);
        }        

    });

    socket.on('ping', function () {
        socket.emit('pong');
    });

    socket.on('disconnect', function () {
        users.splice(findIndex(users, currentPlayer.id), 1);
        console.log('User #' + currentPlayer.id + ' disconnected');

        socket.broadcast.emit(
            'playerDisconnect',
            {
                playersList: users,
                disconnectName: currentPlayer.name
            }
        );
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message});
    });

    socket.on('pass', function(data) {
        if (data[0] === c.adminPass) {
            console.log('Someone just logged in as an admin');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as admin!');
            currentPlayer.admin = true;
        } else {
            console.log('Incorrect Admin Password received');
            socket.emit('serverMSG', 'Password incorrect attempt logged.');
            // TODO actually log incorrect passwords
        }
    });

    socket.on('kick', function(data) {
        if (currentPlayer.admin) {
            for (var e = 0; e < users.length; e++) {
                if (users[e].name === data[0]) {
                    sockets[users[e].id].emit('kick');
                    sockets[users[e].id].disconnect();
                    users.splice(e, 1);
                    console.log('User kicked successfully');
                    socket.emit('serverMSG', 'User kicked successfully');
                }
            }
        } else {
            console.log('Trying admin commands without admin privileges');
            socket.emit('serverMSG', 'You are not permitted to use this command');
        }
    });

    // Heartbeat function, update everytime
    socket.on('0', function(target) {
        // rebalance mass
        balanceMass();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            movePlayer(currentPlayer, target);

            var playerCircle = new C(new V(currentPlayer.x, currentPlayer.y), currentPlayer.mass + c.defaultPlayerSize);

            var foodEaten = food
                .map( function(food) { return SAT.pointInCircle(new V(food.x, food.y), playerCircle); })
                .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

            foodEaten.forEach( function(f) {
                food[f] = {};
                food.splice(f, 1);                
            });

            currentPlayer.mass += c.foodMass * foodEaten.length;
            currentPlayer.speed += (currentPlayer.mass / c.massDecreaseRatio) * foodEaten.length;

            if (foodEaten.length) {
                console.log('Food eaten: ' + foodEaten);
            }

            for (var e = 0; e < users.length; e++) {
                if (hitTest(
                        {x: users[e].x, y: users[e].y},
                        {x: currentPlayer.x, y: currentPlayer.y},
                        currentPlayer.mass + c.defaultPlayerSize
                    ) || hitTest(
                        {x: currentPlayer.x, y: currentPlayer.y},
                        {x: users[e].x, y: users[e].y},
                        users[e].mass + c.defaultPlayerSize
                    )) {
                    if (users[e].mass !== 0 && users[e].mass < currentPlayer.mass - c.eatableMassDistance) {
                        if (currentPlayer.mass < c.maxSizeMass) {
                            currentPlayer.mass += users[e].mass;
                        }

                        if (currentPlayer.speed < c.maxMoveSpeed) {
                            currentPlayer.speed += currentPlayer.mass / c.massDecreaseRatio;
                        }

                        sockets[users[e].id].emit('RIP');
                        sockets[users[e].id].disconnect();
                        users.splice(e, 1);
                        break;
                    }
                    if (currentPlayer.mass !== 0 && currentPlayer.mass < users[e].mass - c.eatableMassDistance) {
                        if (users[e].mass < c.maxSizeMass) {
                            users[e].mass += currentPlayer.mass;
                        }

                        if (users[e].speed < c.maxMoveSpeed) {
                            users[e].speed += users[e].mass / c.massDecreaseRatio;
                        }

                        sockets[currentPlayer.id].emit('RIP');
                        sockets[currentPlayer.id].disconnect();
                        users.splice(currentPlayer, 1);
                        break;
                    }
                }
            }

            // Do some continuous emit
            if (updatereq) {
                socket.emit('serverTellPlayerMove', currentPlayer, food);
                socket.broadcast.emit('serverUpdateAll', users, food);
                updatereq = false;
            } else {
                socket.emit('serverTellPlayerMove', currentPlayer, 0);
                socket.broadcast.emit('serverUpdateAll', users, 0);
            }
        }
    });
});

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
