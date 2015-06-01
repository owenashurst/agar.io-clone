var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var yaml = require('js-yaml');

var configFilePath = 'server/config.yml';

if (!fs.existsSync(configFilePath)) {
    console.log("Config file not found!");
    return;
}

var config = yaml.safeLoad(fs.readFileSync(configFilePath));

var users = [];
var foods = [];
var sockets = [];


var maxSizeMass = config.maxSizeMass;
var maxMoveSpeed = config.maxMoveSpeed;

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

app.use(express.static(__dirname + '/../client'));

function genPos(from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
}

function addFoods(target) {
    foods.push({
        id: (new Date()).getTime(),
        x: genPos(0, target.gameWidth),
        y: genPos(0, target.gameHeight),
        color: randomColor()
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

function randomColor() {
    var color = '#' + ('00000'+(Math.random()*(1<<24)|0).toString(16)).slice(-6),
        difference = 32,
        c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color),
        r = parseInt(c[1], 16) - difference,
        g = parseInt(c[2], 16) - difference,
        b = parseInt(c[3], 16) - difference;

    if (r < 0) {
        r = 0;
    }
    if (g < 0) {
        g = 0;
    }
    if (b < 0) {
        b = 0;
    }

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

	var deltaY = player.speed * Math.sin(deg);
	var deltaX = player.speed * Math.cos(deg);

	if (dist < (100 + defaultPlayerSize + player.mass)) {
		deltaY *= dist / (100 + defaultPlayerSize + player.mass);
		deltaX *= dist / (100 + defaultPlayerSize + player.mass);
	}

    player.y += (player.y + deltaY >= 0 && player.y + deltaY <= player.gameHeight) ? deltaY : 0;
    player.x += (player.x + deltaX >= 0 && player.x + deltaX <= player.gameWidth) ? deltaX : 0;
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
    });

    socket.on('ping', function () {
        socket.emit('pong');
    });

    socket.on('disconnect', function () {
        var playerName = findPlayer(userID).name;

        removePlayer(userID);

        console.log('User #' + userID + ' disconnected');

        socket.broadcast.emit(
            'playerDisconnect',
            {
                playersList: users,
                disconnectName: playerName
            }
        );
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
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
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
