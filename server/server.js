var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var md5 = require('MD5');

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
            id: md5((new Date()).getTime() + '' + (new Date()).getMilliseconds() + '' + food.length),
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

function movePlayer(playerObjects, center, target) {

    var xMin = xMax = playerObjects[0].x;
    var yMin = yMax = playerObjects[0].y;

    for(var i=1; i < playerObjects.length; ++i)
    {
        if(playerObjects[i].x > xMax) xMax = playerObjects[i].x;
        if(playerObjects[i].x < xMin) xMin = playerObjects[i].x;
        if(playerObjects[i].y > yMax) yMax = playerObjects[i].y;
        if(playerObjects[i].y < yMin) yMin = playerObjects[i].y;
    }

    center.x = (xMin + xMax) / 2;
    center.y = (yMin + yMax) / 2;

    var realTarget = { x: center.x + target.x, y: center.y + target.y };
    
    playerObjects.forEach(function(blob, i){
        var dist = Math.sqrt(Math.pow(realTarget.y - blob.y, 2) + Math.pow(realTarget.x - blob.x, 2));
        var deg = Math.atan2(realTarget.y - blob.y, realTarget.x - blob.x);
        
        var slowDown = Math.log(blob.mass);

        var deltaY = blob.speed * Math.sin(deg)/ slowDown;
        var deltaX = blob.speed * Math.cos(deg)/ slowDown;

        if (dist < (50 + blob.mass)) {
            deltaY *= dist / (50 + blob.mass);
            deltaX *= dist / (50 + blob.mass);
        }

        if(!isNaN(deltaY)) blob.y += deltaY;
        if(!isNaN(deltaX)) blob.x += deltaX;    

        if(blob.x > c.gameWidth) blob.x = c.gameWidth;
        if(blob.y > c.gameHeight) blob.y = c.gameHeight;
        if(blob.x < 0) blob.x = 0;
        if(blob.y < 0) blob.y = 0;

        var blobCircle = new C(
                new V(blob.x, blob.y), 
                massToRadius(blob.mass)); 
        
        var otherBlobs = playerObjects.filter(function(b, ii){ return ii != i; });

        otherBlobs.forEach(function(o){
            var response = new SAT.Response();
            var collided = SAT.testCircleCircle(blobCircle,
                new C(new V(o.x, o.y), massToRadius(o.mass)),
                response);

            if(collided) {
                blob.x -= response.overlapV.x;
                blob.y -= response.overlapV.y;
            }
        });
    });
}

function balanceMass(){    
    
    // console.log(users);
    // console.log(users[0].playerObjects);

    var totalMass = food.length * c.foodMass +
        users.map(function(u){ 
            return u.playerObjects.map(function(p){ 
                return p.mass;}).reduce(function(pu,cu){ 
                    return pu+cu;
                }); 
            }).reduce(function(pu,cu){ return pu+cu; });
    
    if(totalMass < c.gameMass) {
        console.log('adding ' + (c.gameMass - totalMass) + ' mass to level');
        addFood(c.gameMass - totalMass);
        console.log('mass rebalanced');
    }
    else if(totalMass > c.gameMass){
        console.log('removing ' + (totalMass - c.gameMass) + ' mass from level');
        removeFood(totalMass - c.gameMass);
        console.log('mass rebalanced');
    }
}

io.on('connection', function (socket) {
    console.log('A user connected!');

    var tx = genPos(0, c.gameWidth);
    var ty = genPos(0, c.gameHeight);

    var currentPlayer = {
        id: socket.id,
        playerObjects: [{
            // x: genPos(0, c.gameWidth),
            // y: genPos(0, c.gameHeight),
            x: tx, y: ty,
            mass: c.defaultPlayerMass},
            {
            // x: genPos(0, c.gameWidth),
            // y: genPos(0, c.gameHeight),
            x: tx +200, y: ty+ 200,
            mass: c.defaultPlayerMass}],
        hue: Math.round(Math.random() * 360),
        center: {x: tx+100, y: ty+100}
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
        // rebalance mass
        balanceMass();        
            

        movePlayer(currentPlayer.playerObjects, currentPlayer.center, target);

        currentPlayer.playerObjects.forEach(function(playerPiece) {
            var playerCircle = new C(
                new V(playerPiece.x, playerPiece.y), 
                massToRadius(playerPiece.mass));

            var foodEaten = food
                .map(function(f){ return SAT.pointInCircle(new V(f.x, f.y), playerCircle); })
                .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

            foodEaten = foodEaten.sort(function (a, b) { return a - b; }).reverse();

            foodEaten.forEach( function(f) {
                food[f] = {};
                food.splice(f, 1);
            });

            playerPiece.mass += c.foodMass * foodEaten.length;
            playerPiece.speed = 10;            
            playerCircle.r = massToRadius(playerPiece.mass);
            
            // var otherUsers = users.filter(function(user) { return user.id != currentPlayer.id; });
            // var playerCollisions = [];
            
            // otherUsers.forEach(function(user) {
            //     var response = new SAT.Response();
            //     var collided = SAT.testCircleCircle(playerCircle,
            //         new C(new V(user.x, user.y), massToRadius(user.mass)),
            //         response);

            //     if (collided) {
            //         response.aUser = currentPlayer;
            //         response.bUser = user;
            //         playerCollisions.push(response);
            //     }
            // });
                                           
            // playerCollisions.forEach(function(collision) {
            //     //TODO: make overlap area-based
            //     if (collision.aUser.mass >  collision.bUser.mass * 1.25 && collision.overlap > 50) {
            //         console.log('KILLING USER: ' + collision.bUser.id);
            //         console.log('collision info:');
            //         console.log(collision);

            //         collision.aUser.mass += collision.bUser.mass;
            //         sockets[collision.bUser.id].emit('RIP');
            //         sockets[collision.bUser.id].disconnect();
            //     }
            // });    
        });
        // console.log(food);
        var visibleFood  = food
            .map(function(f){ 
                if( f.x > currentPlayer.center.x - currentPlayer.screenWidth / 2 - 20 && 
                    f.x < currentPlayer.center.x + currentPlayer.screenWidth / 2 + 20 && 
                    f.y > currentPlayer.center.y - currentPlayer.screenHeight / 2 - 20 && 
                    f.y < currentPlayer.center.y + currentPlayer.screenHeight / 2 + 20) {
                return f; 
                }
            })
            .filter(function(f){ return f; });

        socket.emit('serverTellPlayerMove', currentPlayer, users, visibleFood);

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