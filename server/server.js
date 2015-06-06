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

function massToRadius(mass){
    return Math.sqrt(mass / Math.PI) * 10;
}

function movePlayer(player, target) {
    var dist = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
    var deg = Math.atan2(target.y, target.x);

    var slowDown = Math.log(player.mass);

    var deltaY = player.speed * Math.sin(deg)/ slowDown;
    var deltaX = player.speed * Math.cos(deg)/ slowDown;

    if (dist < (50 + player.mass)) {
        deltaY *= dist / (50 + player.mass);
        deltaX *= dist / (50 + player.mass);
    }

    var borderCalc = player.mass - 5;

    if(!isNaN(deltaY)) player.y += deltaY;
    if(!isNaN(deltaX)) player.x += deltaX;    

    if(player.x > c.gameWidth) player.x = c.gameWidth;
    if(player.y > c.gameHeight) player.y = c.gameHeight;
    if(player.x < 0) player.x = 0;
    if(player.y < 0) player.y = 0;
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
            
            var otherUsers = users.filter(function(user) { return user.id != currentPlayer.id; });
            var playerCollisions = null;

            if (otherUsers.length) {
                playerCollisions = otherUsers.map(function(user) {
                        var response = new SAT.Response();
                        var collided = SAT.testCircleCircle(playerCircle,
                            new C(new V(user.x, user.y), massToRadius(user.mass)),
                            response);
                        if (collided) {
                            response.aUser = currentPlayer;
                            response.bUser = user;
                            return response;
                        }
                    })
                    .reduce(function(b) {return b;});
            }

            if (playerCollisions) {                
                console.log(playerCollisions);
                playerCollisions.forEach(function(collision) {
                    if (playerCollisions.aUser.mass > playerCollisions.bUser.mass * 1.25 && playerCollisions.overlap > 50) {
                        playerCollisions.aUser.mass += playerCollisions.bUser.mass;
                        sockets[playerCollisions.bUser.id].emit('RIP');
                    }
                });
            }

            var visibleFood  = food
                .map(function(f){ 
                    if( f.x > currentPlayer.x - currentPlayer.screenWidth/2 - 20 && 
                        f.x < currentPlayer.x + currentPlayer.screenWidth/2 + 20 && 
                        f.y > currentPlayer.y - currentPlayer.screenHeight/2 - 20 && 
                        f.y < currentPlayer.y + currentPlayer.screenHeight/2 + 20) {
                    return f; 
                    }
                })
                .filter(function(f){ return f; });

            socket.emit('serverTellPlayerMove', currentPlayer, users, visibleFood);
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
