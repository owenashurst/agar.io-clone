var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var SAT = require('sat');

var config = require('./config.json');

app.use(express.static(__dirname + '/../client'));

// import modules
var Player = require(__dirname +'/lib/player');
var BST = require(__dirname + '/lib/bstree');
var PlayerTree = new BST();

var playerID = 0;
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

function hitTest(start, end, min) {
    var distance = Math.sqrt((start.x - end.x) * (start.x - end.x) + (start.y - end.y) * (start.y - end.y));
    return (distance <= min);
}

// function movePlayer(player, target) {
//     var dist = Math.sqrt(Math.pow(target.y - player.screenHeight / 2, 2) + Math.pow(target.x - player.screenWidth / 2, 2)),
//        deg = Math.atan2(target.y - player.screenHeight / 2, target.x - player.screenWidth / 2);
// 
//     //Slows player as mass increases.
//     var slowDown = ((player.mass + 1)/17) + 1;
// 
// 	var deltaY = player.speed * Math.sin(deg)/ slowDown;
// 	var deltaX = player.speed * Math.cos(deg)/ slowDown;
// 
//     if (dist < (100 + defaultPlayerSize + player.mass)) {
//         deltaY *= dist / (100 + defaultPlayerSize + player.mass);
//         deltaX *= dist / (100 + defaultPlayerSize + player.mass);
//     }
// 
//     var borderCalc = defaultPlayerSize + player.mass - 15;
// 
//     player.y += (player.y + deltaY >= borderCalc && player.y + deltaY <= player.gameHeight - borderCalc) ? deltaY : 0;
//     player.x += (player.x + deltaX >= borderCalc && player.x + deltaX <= player.gameWidth - borderCalc) ? deltaX : 0;
// }


// Web socket server
io.on('connection', function (socket) {
    console.log('A user connected. Assigning UserID...');

    // empty currentPlayer
    var currentPlayer = {};

    // Use a per-server, 32-bit integer for uniquely identifying users
    // Overflow happens after the server stays up for 124 days: it was calculated assuming that 200 new users connect every second.
    var userID = playerID++;

    // emit a welcome ping with user id and hue
    socket.emit('welcome', { id : userID, hue : Math.round(Math.random() * 360) });

    // Tell others that a new player has connected upon player acknowledgement
    socket.on('gotit', function (player) {

        currentPlayer = new Player(player);

        // cache the socket object for later
        // TODO : each player should remember it's socket and disconnect itself
        sockets[player.id] = socket;

        // prevents multiple join notifications
        if (PlayerTree.find(player.id) === null) {
            console.log('Player ' + player.id + ' connected!');

        
            PlayerTree.insert(player.id, currentPlayer);

            // rebuild users list
            users = PlayerTree.asArray();
        }

        io.emit('playerJoin', {
            playersList: PlayerTree.asArray(),
            connectedName: player.name
        });

        console.log('Total players: ' + PlayerTree.getSize());

        // Add new food when new player connects
        for (var i = 0; i < newFoodPerPlayer; i++) {
            generateFood(player);
        }

        updatereq = true;
    });

    // respond to client ping connection
    socket.on('ping', function () {
        socket.emit('pong');
    });

    socket.on('disconnect', function () {
        var name = PlayerTree.find(userID).name;

        // remove the user from the tree
        console.log('Removing user:', userID);
        PlayerTree.remove(userID);
        users = PlayerTree.asArray();

        socket.broadcast.emit('playerDisconnect', {
            playersList: users,
            disconnectName: name
        });
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message});
    });

    socket.on('pass', function(data) {
        if (data[0] === config.adminPass) {
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
        if (currentPlayer.admin){
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

        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
      
            // move the current player towards the target
            currentPlayer.move(target, defaultPlayerSize);

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

            // loop though the users to see if
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

                        // remove the player
                        PlayerTree.remove(users[e]);
                        users = PlayerTree.asArray();
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

                        // remove the player
                        PlayerTree.remove(currentPlayer);
                        users = PlayerTree.asArray();
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
