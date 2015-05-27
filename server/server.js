var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var users = [];
var foods = [];
var sockets = [];


var maxSizeMass = 50;
var maxMoveSpeed = 10;

var massDecreaseRatio = 1000;

var foodMass = 1;

var newFoodPerPlayer = 30;
var respawnFoodPerPlayer = 1;

var foodRandomWidth = 500;
var foodRandomHeight = 500;
var maxFoodCount = 50;

var noPlayer = 0;

var defaultPlayerSize = 10;

var eatableMassDistance = 5;

app.use(express.static(__dirname + '/../client'));

function genPos(from, to) {
    return Math.floor(Math.random() * to) + from;
}

function addFoods(target) {
    foods.push({
        id: (new Date()).getTime(),
        x: genPos(0, target.gameWidth),
        y: genPos(0, target.gameHeight)
    });
}

function generateFood(target) {
    if (foods.length < maxFoodCount) {
        addFoods(target);
    }
}

// arr is for example users or foods
function findIndex(arr, id) {
    var len = arr.length;

    while (len--) {
        if (arr[len].id === id) {
            return len;
        }
    }

    return -1;

}

function findPlayer(id) {
    var index = findIndex(users, id);

    return index !== -1 ? users[index] : null;
}

function hitTest(start, end, min) {
    var distance = Math.sqrt((start.x - end.x) * (start.x - end.x) + (start.y - end.y) * (start.y - end.y));
    return (distance <= min);
}

// From giongto35/agar.io-clone
function movePlayer(player, target) {
    var dist = Math.sqrt((target.y - player.screenHeight / 2) * (target.y - player.screenHeight / 2) + (target.x - player.screenWidth / 2) * (target.x - player.screenWidth / 2))
        deg = Math.atan2(target.y - player.screenHeight / 2, target.x - player.screenWidth / 2),
        deltaY = player.speed * Math.min(1, dist / (defaultPlayerSize + player.mass)) * Math.sin(deg),
        deltaX = player.speed * Math.min(1, dist / (defaultPlayerSize + player.mass)) * Math.cos(deg);
    // This code is for moving in a screen
    // deltaY = deltaY > 0 ? deltaY = Math.min(deltaY, target.y - player.y) : deltaY = Math.max(deltaY, target.y - player.y)
    // deltaX = deltaX > 0 ? deltaX = Math.min(deltaX, target.x - player.x) : deltaX = Math.max(deltaX, target.x - player.x)
    
    player.y += ((player.y > 0 || player.y < 0 && deltaY > 0) && (player.y < player.gameHeight || player.y > player.gameHeight && deltaY < 0)) ? deltaY : 0;
    player.x += ((player.x > 0 || player.x < 0 && deltaX > 0) && (player.x < player.gameWidth || player.x > player.gameWidth && deltaX < 0)) ? deltaX : 0;
}


io.on('connection', function (socket) {
    console.log('A user connected. Assigning UserID...');

    var userID = socket.id;
    var currentPlayer = {};

    socket.emit('welcome', userID);

    socket.on('gotit', function (player) {
        player.id = userID;
        sockets[player.id] = socket;

        if (findPlayer(player.id) == null) {
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
    });

    socket.on('ping', function () {
        socket.emit('pong');
    });

    socket.on('disconnect', function () {
        var playerIndex = findIndex(users, userID);
        var playerName = users[playerIndex].name;
        users.splice(playerIndex, 1);
        console.log('User #' + userID + ' disconnected');
        socket.broadcast.emit('playerDisconnect', {playersList: users, disconnectName: playerName});
    });

    socket.on('playerChat', function (data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message});
    });

    // Heartbeat function, update everytime
    socket.on('playerSendTarget', function (target) {
     // if you want to use uncomment the line below
    //    console.log(currentPlayer.x + " " + currentPlayer.y);
        if (target.x != currentPlayer.x || target.y != currentPlayer.y) {
            movePlayer(currentPlayer, target);

            for (var f = 0; f < foods.length; f++) {
                if (hitTest(
                        {x: foods[f].x, y: foods[f].y},
                        {x: currentPlayer.x, y: currentPlayer.y},
                        currentPlayer.mass + defaultPlayerSize
                    )) {
                    foods[f] = {};
                    foods.splice(f, 1);

                    if (currentPlayer.mass < maxSizeMass) {
                        currentPlayer.mass += foodMass;
                    }

                    if (currentPlayer.speed < maxMoveSpeed) {
                        currentPlayer.speed += currentPlayer.mass / massDecreaseRatio;
                    }

                    console.log('Food eaten');

                    // Respawn food
                    for (var r = 0; r < respawnFoodPerPlayer; r++) {
                        generateFood(currentPlayer);
                    }
                    break;
                }
            }

            for (var e = 0; e < users.length; e++) {
                if (hitTest(
                        {x: users[e].x, y: users[e].y},
                        {x: currentPlayer.x, y: currentPlayer.y},
                        currentPlayer.mass + defaultPlayerSize
                    )) {
                    if (users[e].mass != 0 && users[e].mass < currentPlayer.mass - eatableMassDistance) {
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
                }
            }

            // Do some continuos emit
            socket.emit('serverTellPlayerMove', currentPlayer);
            socket.emit('serverTellPlayerUpdateFoods', foods);
            socket.broadcast.emit('serverUpdateAllPlayers', users);
            socket.broadcast.emit('serverUpdateAllFoods', foods);
        }
    });
});

// Don't touch on ip
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 3000;
http.listen( serverport, ipaddress, function() {
    console.log('listening on *:' + serverport);
});
