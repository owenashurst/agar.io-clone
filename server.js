var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var users = [];
var foods = [];
var sockets = [];

var maxSizeMass = 50;

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

function genPos(from, to) {
    return Math.floor(Math.random() * to) + from;
}

function addFoods() {
    var rx = genPos(0, 2000);
    var ry = genPos(0, 1000);
    var food = {
        foodID: (new Date()).getTime(),
        x: rx, y: ry
    };

    foods[foods.length] = food;
}

setInterval(function(){
    if (foods.length < 50) {
        addFoods();
    }

    if (users.length == 0) {
        foods = [];
    }
}, 1000);

function findPlayer(id) {
    for (var i = 0; i < users.length; i++) {
        if (users[i].playerID == id) {
            return users[i];
        }
    }

    return null;
}

function findPlayerIndex(id) {
    for (var i = 0; i < users.length; i++) {
        if (users[i].playerID == id) {
            return i;
        }
    }

    return -1;
}

function findFoodIndex(id) {
    for (var i = 0; i < foods.length; i++) {
        if (foods[i].foodID == id) {
            return i;
        }
    }

  return -1;
}

function hitTest(start, end, min) {
    var distance = Math.sqrt((start.x - end.x) * (start.x - end.x) + (start.y - end.y) * (start.y - end.y));
    console.log("Hit test: " + distance + " - Min distance: " + min);
    return (distance <= min);
}

io.on('connection', function(socket) {  
    console.log('A user connected. Assigning UserID...');

    var userID = socket.id;
    var currentPlayer = {};

    socket.emit("welcome", userID);

    socket.on("gotit", function(player) {
        player.playerID = userID;
        sockets[player.playerID] = socket;

        if (findPlayer(player.playerID) == null) {
            console.log("Player " + player.playerID + " connected!");
            users.push(player);
            currentPlayer = player;
        }

        socket.emit("playerJoin", users);
        socket.broadcast.emit("playerJoin", users);
        console.log("Total player: " + users.length);
    });

    socket.on('disconnect', function() {
        users.splice(findPlayerIndex(userID), 1);
        console.log('User #' + userID + ' disconnected');
        socket.broadcast.emit("playerDisconnect", users);
    });

    // Heartbeat function, update everytime
    socket.on("playerSendTarget", function(target) {
        if (target.x != currentPlayer.x && target.y != currentPlayer.y) {
            currentPlayer.x += (target.x - currentPlayer.x) / currentPlayer.speed;
            currentPlayer.y += (target.y - currentPlayer.y) / currentPlayer.speed;

            users[findPlayerIndex(currentPlayer.playerID)] = currentPlayer;
      
            for (var f = 0; f < foods.length; f++) {
                if (hitTest(
                    { x: foods[f].x, y: foods[f].y },
                    { x: currentPlayer.x, y: currentPlayer.y },
                    currentPlayer.mass + 10
                )) {
                    foods[f] = {};
                    foods.splice(f, 1);

                    if (currentPlayer.mass < maxSizeMass) {
                        currentPlayer.mass += 1;
                    }

                    if (currentPlayer.speed < 100) {
                        currentPlayer.speed += currentPlayer.mass / 1000;
                    }

                    console.log("Player eaten");
                    break;
                }
            }

            for (var e = 0; e < users.length; e++) {
                if (hitTest(
                    { x: users[e].x, y: users[e].y },
                    { x: currentPlayer.x, y: currentPlayer.y },
                    currentPlayer.mass + 10
                )) {
                    if (users[e].mass != 0 && users[e].mass < currentPlayer.mass - 5) {           
                        if (currentPlayer.mass < maxSizeMass) {
                            currentPlayer.mass += users[e].mass;
                        }

                        if (currentPlayer.speed < 100) {
                            currentPlayer.speed += currentPlayer.mass / 1000;
                        }

                        sockets[users[e].playerID].emit("RIP");
                        users.splice(e, 1);
                        break;
                    }
                }
            }

            // Do some continuos emit
            socket.emit("serverTellPlayerMove", currentPlayer);
            socket.emit("serverTellPlayerUpdateFoods", foods);
            socket.broadcast.emit("serverUpdateAllPlayers", users);
            socket.broadcast.emit("serverUpdateAllFoods", foods);
        }
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});