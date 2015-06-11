var v = require('vectorize');
var playerName;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;
var KEY_ENTER = 13;
var borderDraw = false;

var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;

var gameStart = false;
var disconnected = false;
var died = false;
var kicked = false;

var initialX, initialY;

var startPingTime = 0;

var chatCommands = {};
var backgroundColor = '#EEEEEE';

// needed for weird two.js svg import weirdness
var textFix = false;

// variable g will hold game settings received from server
var g = {};

var player = {
    id: -1,
    playerObjects: [{
        x: screenWidth / 2,
        y: screenHeight / 2
        }],  
    screenWidth: screenWidth,
    screenHeight: screenHeight,    
};

var foods = [];
var enemies = [];
var target = {x: 0, y: 0};

var two = new Two({
    type: Two.Types["webgl"],
    fullscreen: true,
    autostart: true
}).appendTo(document.getElementById('gameArea'));

Two.Resolution = 16;

// variable t holds all two.js objects
var t = {
    foodObjects: {},
    displayName: null,    
    mouse: new Two.Vector(),
    gridGroup: two.makeGroup(),
    foodGroup: two.makeGroup(),
    playerGroup: two.makeGroup()
}

t.playerGroup.blobs = {};

function addPlayerBlob(blob, id, center){
    console.debug(blob);
    var blobGroup = two.makeGroup();

    var shadow = two.makeCircle(0, 0, 10);

    shadow.name = 'shadow';

    shadow.noStroke().fill = 'rgba(0, 0, 0, 0.2)';
    shadow.offset = new Two.Vector(- massToRadius(blob.mass) / 2, massToRadius(blob.mass) * 2);
    shadow.scale = 1.25;

    shadow.addTo(blobGroup);

    var ball = two.makeCircle(0, 0, 10);

    ball.name = 'ball';

    // make copy of original vertex coordinates for later reference
    _.each(ball.vertices, function(v) { v.origin = new Two.Vector().copy(v); });

    ball.addTo(blobGroup);

    ball.fill = 'hsla(' + player.hue + ',90%,50%,0.9)';
    ball.linewidth - 0.5;
    ball.stroke = 'hsla(' + player.hue + ',90%,20%,0.9)';

    blobGroup.translation.x = blob.x - center.x;
    blobGroup.translation.y = blob.y - center.y;
    blobGroup.addTo(t.playerGroup);
    t.playerGroup.blobs[id] = blobGroup;
}

t.playerGroup.translation.x = screenWidth / 2;
t.playerGroup.translation.y = screenHeight / 2;

function findElement(toFind, toSearch){
    for(var i = 0; i < toSearch.length; ++i){
        // coercable '==' is intentional here
        if(toSearch[i].id == toFind) return i;
    }
    return -1;
}

function massToRadius(mass){
    return Math.sqrt(mass / Math.PI) * 10;
}

// register when the mouse goes off the canvas
function outOfBounds() {    
    target = { x : 0, y: 0 };
}

function visibleBorder() {
        if (document.getElementById('visBord').checked) {
            borderDraw = true;
        } else {
            borderDraw= false;
        }
}

var chatInput = document.getElementById('chatInput');
chatInput.addEventListener('keypress', sendChat);

function startGame() {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '');

    // var polygons = v.vectorize(playerName, { polygons: true, width: 15, textBaseline: "hanging", font: "arial", size: 80 });

    // var svg = [];
    // svg.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"  width="500"  height="80" >');
    // polygons.forEach(function(loops) {
    //     svg.push('<path d="');
    //     loops.forEach(function(loop) {
    //         var start = loop[0];
    //         svg.push('M ' + start[0] + ' ' + start[1]);
    //         for(var i=1; i<loop.length; ++i) {
    //             var p = loop[i];
    //             svg.push('L ' + p[0] + ' ' + p[1]);
    //         }
    //         svg.push('L ' + start[0] + ' ' + start[1]);
    //     });
    //     svg.push('" fill-rule="even-odd" stroke-width="1" fill="red"></path>')
    // });
    // svg.push('</svg>');

    // $new = $();
    // $new = $new.add(svg.join(""));
    // t.displayName = two.interpret($new[0]).addTo(t.playerGroup);    
    // t.displayName.fill = 'white';
    // t.displayName.stroke = 'black';
    // t.displayName.linewidth = 0.3;

    // delete $new;

    // _.each(($.map(t.displayName.children, function(f){return f;})), function(p, j){
    //     _.each(p.vertices, function(v){
    //         v.origin = new Two.Vector().copy(v);   
    //     });
    // });

    document.getElementById('gameAreaWrapper').style.display = 'block';
    document.getElementById('startMenuWrapper').style.display = 'none';
    socket = io();
    setupSocket(socket);
}

// check if nick is valid alphanumeric characters (and underscores)
function validNick() {
    var regex = /^\w*$/;
    console.log("Regex Test", regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function() {
    'use strict';

    var btn = document.getElementById('startButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btn.onclick = function () {

        // check if the nick is valid
        if (validNick()) {
            startGame();
        } else {
            nickErrorText.style.display = 'inline';
        }
    };

    var settingsMenu = document.getElementById('settingsButton');

    settingsMenu.onclick = function () {
        if (settings.style.display != 'block') {
            instructions.style.display = 'none';
            settings.style.display = 'block';
        } else {
            instructions.style.display = 'block';
            settings.style.display = 'none';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === KEY_ENTER) {
            if (validNick()) {
                startGame();
            } else {
                nickErrorText.style.display = 'inline';
            }
        }
    });
};


// Chat
function addChatLine(name, text) {
    var chatLine = document.createElement('li');
    chatLine.className = (name == player.name)?'me':'friend';
    chatLine.innerHTML = '<b>' + name + '</b>: ' + text;
    var chatList = document.getElementById('chatList');
    if (chatList.childNodes.length >=11) {
        chatList.removeChild(chatList.childNodes[0]);
    }
    chatList.appendChild(chatLine);
}

function addSystemLine(text) {
    var chatLine = document.createElement('li');
    chatLine.className = 'system';
    chatLine.innerHTML = text;
    var chatList = document.getElementById('chatList');
    if (chatList.childNodes.length >=11) {
        chatList.removeChild(chatList.childNodes[0]);
    }
    chatList.appendChild(chatLine);
}

function registerChatCommand(name, description, callback) {
    chatCommands[name] = {
        description: description,
        callback: callback
    };
}

function checkLatency() {
    // Ping
    startPingTime = Date.now();
    socket.emit('ping');
}

function toggleDarkMode(args) {
    var LIGHT = '#EEEEEE';
    var DARK = '#181818';
    var on = args[0] === 'on';
    var off = args[0] === 'off';

    if (on || (!off && backgroundColor === LIGHT)) {
        backgroundColor = DARK;
        addSystemLine('Dark mode enabled');
    } else {
        backgroundColor = LIGHT;
        addSystemLine('Dark mode disabled');
    }
}

function printHelp() {
    for (var command in chatCommands) {
        if (chatCommands.hasOwnProperty(command)) {
            addSystemLine('-' + command + ': ' + chatCommands[command].description);
        }
    }
}

registerChatCommand('ping', 'Check your latency', function () {
    checkLatency();
});

registerChatCommand('dark', 'Toggle dark mode', function (args) {
    toggleDarkMode(args);
});

registerChatCommand('help', 'Chat commands information', function () {
    printHelp();
});

registerChatCommand('login', 'Login as an admin', function (args) {
    socket.emit('pass', args);
});

registerChatCommand('kick', 'Kick a player', function (args) {
    socket.emit('kick', args);
});

function diffFood(o, n) {
    return o.filter(function(i) {return n.indexOf(i) < 0;});
};

function sendChat(key) {
    key = key.which || key.keyCode;
    if (key == KEY_ENTER) {
        var text = chatInput.value.replace(/(<([^>]+)>)/ig,'');
        if (text !== '') {
            if (text.indexOf('-') === 0) {
                var args = text.substring(1).split(' ');
                if (chatCommands[args[0]]) {
                    chatCommands[args[0]].callback(args.slice(1));
                } else {
                    addSystemLine('Unrecoginised Command: ' + text + ', type -help for more info');
                }
            } else {
                socket.emit('playerChat', { sender: player.name, message: text });
                addChatLine(player.name, text);
            }
            chatInput.value = '';
        }
    }
}

function setupSocket(socket) {
    // Handle ping
    socket.on('pong', function () {
        var latency = Date.now() - startPingTime;
        console.log('Latency: ' + latency + 'ms');
        addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error
    socket.on('connect_failed', function () {
        socket.close();
        disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        disconnected = true;
    });

    // Handle connection
    socket.on('welcome', function (playerSettings) {
        player = playerSettings;        
        player.name = playerName; 
        player.screenWidth = screenWidth;
        player.screenHeight = screenHeight; 
        socket.emit('gotit', player);
        
        player.playerObjects.forEach(function(p, i){
            addPlayerBlob(p, i, player.center);
        });

        gameStart = true;
        console.log('Game is started: ' + gameStart);
        addSystemLine('Connected to the game!');
        addSystemLine('Type <b>-help</b> for a list of commands');
        initialX = player.playerObjects[0].x;
        initialY = player.playerObjects[0].y;
    });

    socket.on('gameSetup', function(data){
        g = data;
     });

    socket.on('playerDisconnect', function (data) {
        enemies = data.playersList;
        document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
        addSystemLine('Player <b>' + data.disconnectName + '</b> disconnected!');
    });

    socket.on('playerDied', function (data) {
        enemies = data.playersList;
        document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
        addSystemLine('Player <b>' + data.disconnectName + '</b> died!');
    });

    socket.on('playerJoin', function (data) {
        console.log(data);
        enemies = data.playersList;
        document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
        addSystemLine('Player <b>' + data.connectedName + '</b> joined!');
    });

    socket.on('serverMSG', function (data) {
        
        addSystemLine(data);
    });

    // Chat
    socket.on('serverSendPlayerChat', function (data) {
      
        addChatLine(data.sender, data.message);
    });

    // Handle movement
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList) {
        
        player = playerData;
        enemies = userData;

        player.playerObjects.forEach(function(p, i){
            _.each(t.playerGroup.blobs[i].children, function(b){
                b.scale = massToRadius(p.mass) / 10.0;
            });
        });

        // for(var key in t.displayName.children){
        //     t.displayName.children[key].scale = 1;
        // }

        var originalFoodsList = foods.map(function(f){ return f.id; });
        var newFoodsList = foodsList.map(function(f){ return f.id; });

        var newFood = diffFood(newFoodsList, originalFoodsList);
        var removedFood = diffFood(originalFoodsList,newFoodsList);

        if(newFood.length) {
            for(var i = 0; i < newFood.length; ++i){
                var foodID = findElement(newFood[i], foodsList);
                drawFood(foodsList[foodID]);
            }
        }

        if(removedFood.length){
            for(var i = 0; i < removedFood.length; ++i){
                t.foodGroup.remove(t.foodObjects[removedFood[i]]);
                delete t.foodObjects[removedFood[i]];
            }
        }
        foods = foodsList;

        t.foodGroup.translation.x = -player.center.x + screenWidth/2;
        t.foodGroup.translation.y = -player.center.y + screenHeight/2;
    });

    socket.on('serverUpdateAll', function (players, foodsList) {
        enemies = players;
        if(foodsList !== 0){
        foods = foodsList;
        }
    });

    // Die
    socket.on('RIP', function () {
        gameStart = false;
        died = true;
        // socket.close();
    });

    socket.on('kick', function (data) {
        gameStart = false;
        reason = data;
        kicked = true;
        socket.close();
    });
}

function drawFood(food) {
    if(!t.foodObjects.hasOwnProperty(food.id)){
        var f = two.makeCircle(food.x, food.y, massToRadius(g.foodMass));
        // console.log(food.color);
        f.fill = food.color.fill;
        f.stroke = food.color.border;
        f.linewidth = 1.0;
        t.foodObjects[food.id] = f;
        f.addTo(t.foodGroup);
    }
}

function drawEnemy(enemy) {

    // var fontSize = (massToRadius(enemy.mass) / 2);

}

var $window = $(window).bind('mousemove', function(e) {
    t.mouse.x = e.clientX;
    t.mouse.y = e.clientY;
    target.x = e.clientX - screenWidth / 2;
    target.y = e.clientY - screenHeight / 2;
    // shadow.offset.x = 5 * t.radius * (t.mouse.x - two.width / 2) / two.width;
    // shadow.offset.y = 5 * t.radius * (t.mouse.y - two.height / 2) / two.height;
})
.bind('touchstart', function() {
    e.preventDefault();
    return false;
})
.bind('touchmove', function(e) {
    e.preventDefault();
    var touch = e.originalEvent.changedTouches[0];
    t.mouse.x = touch.pageX;
    t.mouse.y = touch.pageY;
    // shadow.offset.x = 5 * t.radius * (t.mouse.x - two.width / 2) / two.width;
    // shadow.offset.y = 5 * t.radius * (t.mouse.y - two.height / 2) / two.height;
    return false;
});

two.bind('update', function() {
    if (!disconnected) {
        if (gameStart) {
            

            player.playerObjects.forEach(function(p,i){
                t.playerGroup.blobs[i].translation.x = p.x - player.center.x;
                t.playerGroup.blobs[i].translation.y = p.y - player.center.y;
            });
            
            // _.each(t.playerGroup.children, function(p){ 
            //     _.each(p.children, function(b){
            //         if(b.name == 'ball'){
            //              _.each(b.vertices, function(v, i){
            //                 var toMove = Math.sin(two.frameCount/10 + i);
            //                 // var toMovey = Math.cos(two.frameCount/12 + i);
            //                 // v.x = v.origin.x + (toMovey * (v.origin.x / 10)) / (b.scale / 2);
            //                 v.y = v.origin.y + (toMove * (v.origin.y / 10)) / (b.scale / 2);
            //             });
            //         }
            //     });
            // });
           

            // t.displayName.translation.x = ball.getBoundingClientRect().left + (ball.getBoundingClientRect().width / 2) - t.displayName.getBoundingClientRect().width / 2 - screenWidth / 2;
            // t.displayName.translation.y = ball.getBoundingClientRect().top + (ball.getBoundingClientRect().height / 2) - t.displayName.getBoundingClientRect().height / 2 - screenHeight /2;

            foods.forEach(function(f){ drawFood(f); });
    
            // for (i = 0; i < enemies.length; i++) {
            //     if (enemies[i].id != player.id) {
            //         drawEnemy(enemies[i]);
            //     }
            // }

            var playerOffset = new Two.Vector();
            playerOffset.x =  player.playerObjects[0].x - initialX;
            playerOffset.y =  player.playerObjects[0].y - initialY;
            
            t.gridGroup.translation.set(-playerOffset.x * 0.6, -playerOffset.y * 0.6);

            while(gridObjectH[0].getBoundingClientRect().left < -25){
                gridObjectH[0].translation.x = gridObjectH[gridObjectH.length-1].translation.x + 15;
                var a = gridObjectH.shift();
                gridObjectH.push(a);
                gridObjectV.forEach(function(g){
                    g.translation.x += 15;
                });
            }
            while(gridObjectH[gridObjectH.length-1].getBoundingClientRect().right > screenWidth + 25){
                gridObjectH[gridObjectH.length-1].translation.x = gridObjectH[0].translation.x - 15;
                var a = gridObjectH.pop();
                gridObjectH.unshift(a);
                gridObjectV.forEach(function(g){
                    g.translation.x -= 15;
                });
            }

            while(gridObjectV[0].getBoundingClientRect().top < -25){
                gridObjectV[0].translation.y = gridObjectV[gridObjectV.length-1].translation.y + 15;
                var a = gridObjectV.shift();
                gridObjectV.push(a);
                gridObjectH.forEach(function(g){
                    g.translation.y += 15;
                });
            }
            while(gridObjectV[gridObjectV.length-1].getBoundingClientRect().bottom > screenHeight + 25){
                gridObjectV[gridObjectV.length-1].translation.y = gridObjectV[0].translation.y - 15;
                var a = gridObjectV.pop();
                gridObjectV.unshift(a);
                gridObjectH.forEach(function(g){
                    g.translation.y -= 15;
                });
            }
            socket.emit('0', target); // playerSendTarget Heartbeat
                

        }
    }
});

window.addEventListener('resize', function() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    player.screenWidth = screenWidth;
    player.screenHeight = screenHeight;
}, true);


var gridObjectH = [];
var gridObjectV = [];

function createGrid(s) {

    var h = two.height;
    var w = two.width;

    for(var i = -50; i<two.width+50; i += 15){
        var a = two.makeLine(i, -50, i, h+50).addTo(t.gridGroup);
        a.stroke = 'rgba(109, 207, 246, 0.32)';    
        gridObjectH.push(a);
    }

    for(var j = -50; j<two.height+50; j +=15){
        var a = two.makeLine(-50, j, w+50, j).addTo(t.gridGroup);
        a.stroke = 'rgba(109, 207, 246, 0.32)';    
        gridObjectV.push(a);
    }
}

createGrid();