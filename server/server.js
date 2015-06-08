var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var SAT = require('sat');

var config = require('./config.json');

var users = [];
var foods = [];
var sockets = [];
var updatereq = true;

var maxSizeMass = config.maxSizeMass;
var maxMoveSpeed = config.maxMoveSpeed;
var password = config.adminPass;

var massDecreaseRatio = config.massDecreaseRatio;

var foodMass = config.foodMass;

var newFoodPerPlayer = config.newFoodPerPlayer;
var respawnFoodPerPlayer = config.respawnFoodPerPlayer;

var foodRandomWidth = config.foodRandomWidth;
var foodRandomHeight = config.foodRandomHeight;
var maxFoodCount = config.maxFoodCount;

var noPlayer = config.noPlayer;

var defaultPlayerSize = config.defaultPlayerSize;

var eatableMassDistance = config.eatableMassDistance;

var V = SAT.Vector;
var C = SAT.Circle;

app.use(express.static(__dirname + '/../client'));

function genPos(from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
}

function addFoods(target) {
    foods.push({
        id: (new Date()).getTime(),
        x: genPos(0, target.gameWidth),
        y: genPos(0, target.gameHeight),
        color: randomColor(),
        rotation: Math.random() * (Math.PI * 2)
    });
}

function generateFood(target) {
    if (foods.length < maxFoodCount) {
        addFoods(target);
    }
}

// arr is for example users or foods
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

    if (dist < (100 + defaultPlayerSize + player.mass)) {
        deltaY *= dist / (100 + defaultPlayerSize + player.mass);
        deltaX *= dist / (100 + defaultPlayerSize + player.mass);
    }

    var borderCalc = defaultPlayerSize + player.mass - 15;

    player.y += (player.y + deltaY >= borderCalc && player.y + deltaY <= player.gameHeight - borderCalc) ? deltaY : 0;
    player.x += (player.x + deltaX >= borderCalc && player.x + deltaX <= player.gameWidth - borderCalc) ? deltaX : 0;
}


io.on('connection', function (socket) {
    console.log('A user connected. Assigning UserID...');

    var userID = socket.id;
    var playerSettings = {
      id: userID,
      hue: Math.round(Math.random() * 360)
    };
    var currentPlayer = {};

    socket.emit('welcome', playerSettings);

    socket.on('gotit', function (player) {
        player.id = userID;
        sockets[player.id] = socket;

        if (findPlayer(player.id) === null) {
            console.log('Player ' + player.id + ' connected!');
            users.push(player);
            currentPlayer = player;
        }

        io.emit('playerJoin', {playersList: users, connectedName: player.name});
        console.log('Total player: ' + users.length);

        // Add new food when player connected
        for (var i = 0; i < newFoodPerPlayer; i++) {
            generateFood(player);
        }

        updatereq = true;
    });

    socket.on('ping', function () {
        socket.emit('pong');
    });

    socket.on('disconnect', function () {
        var playerDisconnected = findPlayer(userID);

        if (playerDisconnected !== null && playerDisconnected.hasOwnProperty('name')) {
            removePlayer(userID);

            console.log('User #' + userID + ' disconnected');

            socket.broadcast.emit(
                'playerDisconnect',
                {
                    playersList: users,
                    disconnectName: playerDisconnected.name
                }
            );
        } else {
            console.log('Unknown user disconnected');
        }
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message});
    });

    socket.on('pass', function(data) {
        if (data[0] === config.adminPass) {
            console.log(currentPlayer.name + " just logged in as an admin");
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as admin!');
            currentPlayer.admin = true;
        } else {
            console.log(currentPlayer.name + " sent incorrect admin password");
            socket.emit('serverMSG', 'Password incorrect attempt logged.');
            // TODO actually log incorrect passwords
        }
    });

    socket.on('kick', function(data) {
        if (currentPlayer.admin) {
            var reason = "";
            var worked = false;
            for (var e = 0; e < users.length; e++) {
                if (users[e].name === data[0] && !users[e].admin && !worked){
                    if(data.length > 1){
                               for (var f = 1; f < data.length; f++) {
                                    if(f == data.length){
                                           reason = reason + data[f];
                                     }
                                     else{
                                           reason = reason + data[f] + " ";
                                     }
                               }
                               
                           }
                if(reason !== ""){
                       console.log("User " + users[e].name + " kicked successfully by " + currentPlayer.name + " for reason " + reason);
                   }
                   else{
                       console.log("User " + users[e].name + " kicked successfully by " + currentPlayer.name);
                   }
                   socket.emit('serverMSG', "User " + users[e].name + " was kicked by " + currentPlayer.name);
                   sockets[users[e].id].emit('kick', reason);
                   sockets[users[e].id].disconnect();
                   users.splice(e, 1);
                    worked = true;
                }
            }
            if(!worked){
                       socket.emit('serverMSG', "Could not find user or user is admin");
           }
        } else {
            console.log(currentPlayer.name + " is trying to use -kick but isn't admin");
            socket.emit('serverMSG', 'You are not permitted to use this command');
        }
    });

    // Heartbeat function, update everytime
    socket.on('0', function(target) {

        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            movePlayer(currentPlayer, target);

            var playerCircle = new C(new V(currentPlayer.x, currentPlayer.y), currentPlayer.mass + config.defaultPlayerSize);

            var foodEaten = foods
                .map( function(food) { return SAT.pointInCircle(new V(food.x, food.y), playerCircle); })
                .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

            foodEaten.forEach( function(food) {
                foods[food] = {};
                foods.splice(food, 1);
                generateFood(currentPlayer);
            });

            currentPlayer.mass += foodMass * foodEaten.length;
            currentPlayer.speed += (currentPlayer.mass / massDecreaseRatio) * foodEaten.length;

            if (foodEaten.length) {
                console.log('Food eaten: ' + foodEaten);
                updatereq = true;
            }

            for (var e = 0; e < users.length; e++) {
                if (hitTest(
                        {x: users[e].x, y: users[e].y},
                        {x: currentPlayer.x, y: currentPlayer.y},
                        currentPlayer.mass + defaultPlayerSize
                    ) || hitTest(
                        {x: currentPlayer.x, y: currentPlayer.y},
                        {x: users[e].x, y: users[e].y},
                        users[e].mass + defaultPlayerSize
                    )) {
                    if (users[e].mass !== 0 && users[e].mass < currentPlayer.mass - eatableMassDistance) {
                        if (currentPlayer.mass < maxSizeMass) {
                            currentPlayer.mass += users[e].mass;
                        }

                        if (currentPlayer.speed < maxMoveSpeed) {
                            currentPlayer.speed += currentPlayer.mass / massDecreaseRatio;
                        }

                        sockets[users[e].id].emit('RIP');
                        sockets[users[e].id].disconnect();
                        users.splice(e, 1);
                        break;
                    }
                    if (currentPlayer.mass !== 0 && currentPlayer.mass < users[e].mass - eatableMassDistance) {
                        if (users[e].mass < maxSizeMass) {
                            users[e].mass += currentPlayer.mass;
                        }

                        if (users[e].speed < maxMoveSpeed) {
                            users[e].speed += users[e].mass / massDecreaseRatio;
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
                socket.emit('serverTellPlayerMove', currentPlayer, foods);
                socket.broadcast.emit('serverUpdateAll', users, foods);
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
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
    http.listen( serverport, ipaddress, function() {
        console.log('listening on *:' + serverport);
    });
} else {
    http.listen( serverport, function() {
        console.log('listening on *:' + config.port);
    });
}
