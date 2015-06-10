var v = require('vectorize');
var playerName;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;
var KEY_ENTER = 13;
var borderDraw = false;

var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;
var gameWidth = 0;
var gameHeight = 0;
var xoffset = -gameWidth;
var yoffset = -gameHeight;

var gameStart = false;
var disconnected = false;
var died = false;
var kicked = false;

var startPingTime = 0;

var chatCommands = {};
var backgroundColor = '#EEEEEE';

var foodConfig = {
    border: 0,
    borderColor: '#f39c12',
    fillColor: '#f1c40f',
    mass: 1.0,
    radius: massToRadius(1.0)
};

var playerConfig = {
    border: 5,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var enemyConfig = {
    border: 5,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: screenWidth / 2, 
    y: screenHeight / 2,    
    screenWidth: screenWidth,
    screenHeight: screenHeight,    
};

var foods = [];
var foodObjects = {};
var enemies = [];
var target = {x: player.x, y: player.y};

var displayName = null;

var delta = new Two.Vector();
var mouse = new Two.Vector();
var drag = 0.33;
var radius = 10;

var two = new Two({
    type: Two.Types["webgl"],
    fullscreen: true,
    autostart: true
}).appendTo(document.getElementById('gameArea'));

Two.Resoultion = 32;

var shadow = two.makeCircle(two.width / 2, two.height / 2, radius);
shadow.noStroke().fill = 'rgba(0, 0, 0, 0.2)';
shadow.offset = new Two.Vector(- radius / 2, radius * 2);
shadow.scale = 0.85;

var ball = two.makeCircle(two.width / 2, two.height / 2, radius);
ball.noStroke().fill = 'white';

_.each(ball.vertices, function(v) {
    v.origin = new Two.Vector().copy(v);    
});

var foodGroup = two.makeGroup();
var group = two.makeGroup(shadow,ball);

function findElement(toFind, toSearch){
    for(var i = 0; i < toSearch.length; ++i){
        // coercable '==' is intentional here
        if(toSearch[i].id == toFind) return i;
    }
    return -1;
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

// var graph = c.getContext('2d');

var chatInput = document.getElementById('chatInput');
chatInput.addEventListener('keypress', sendChat);

function startGame() {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '');

    var polygons = v.vectorize(playerName, { polygons: true, width: 10, textBaseline: "hanging", font: "sans-serif", size: 128 });


    var svg = [];
    svg.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"  width="500"  height="80" >');
    polygons.forEach(function(loops) {
        svg.push('<path d="');
        loops.forEach(function(loop) {
            var start = loop[0];
            svg.push('M ' + start[0] + ' ' + start[1]);
            for(var i=1; i<loop.length; ++i) {
                var p = loop[i];
                svg.push('L ' + p[0] + ' ' + p[1]);
            }
            svg.push('L ' + start[0] + ' ' + start[1]);
        });
        svg.push('" fill-rule="even-odd" stroke-width="1" fill="red"></path>')
    });
    svg.push('</svg>');

    $new = $();
    $new = $new.add(svg.join(""));
    displayName = two.interpret($new[0]).addTo(group);
    displayName.translation.addSelf(ball.translation);
    displayName.translation.x -= 5;
    displayName.translation.y -= 2;
    displayName.fill = 'white';
    displayName.stroke = 'black';
    displayName.linewidth = 0.2;


    _.each(($.map(displayName.children, function(f){return f;})), function(p, j){
        _.each(p.vertices, function(v){
            v.origin = new Two.Vector().copy(v);   
        });
    });

    document.getElementById('gameAreaWrapper').style.display = 'block';
    document.getElementById('startMenuWrapper').style.display = 'none';
    socket = io();
    setupSocket(socket);
    // animloop();
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
        ball.fill = 'hsla(' + player.hue + ',90%,50%,0.9)';
        ball.linewidth - 0.5;
        ball.stroke = 'hsla(' + player.hue + ',90%,20%,0.9)';
        gameStart = true;
        console.log('Game is started: ' + gameStart);
        addSystemLine('Connected to the game!');
        addSystemLine('Type <b>-help</b> for a list of commands');
    });

    socket.on('gameSetup', function(data){
        gameWidth = data.gameWidth;
        gameHeight = data.gameHeight;        
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
        var xoffset = player.x - playerData.x;
        var yoffset = player.y - playerData.y;
        
        player = playerData;
        player.xoffset = isNaN(xoffset) ? 0 : xoffset;
        player.yoffset = isNaN(yoffset) ? 0 : yoffset;

        enemies = userData;

        var originalFoodsList = foods.map(function(f){ return f.id; });
        var newFoodsList = foodsList.map(function(f){ return f.id; });

        var newFood = diffFood(newFoodsList, originalFoodsList);
        var removedFood = diffFood(originalFoodsList,newFoodsList);

        ball.scale = shadow.scale = massToRadius(player.mass) / 10.0;

        for(var key in displayName.children){
            displayName.children[key].scale = ball.scale;
        }

        if(newFood.length) {
            for(var i = 0; i < newFood.length; ++i){
                var foodID = findElement(newFood[i], foodsList);
                drawFood(foodsList[foodID]);
            }
        }

        if(removedFood.length){
            for(var i = 0; i < removedFood.length; ++i){
                foodGroup.remove(foodObjects[removedFood[i]]);
                delete foodObjects[removedFood[i]];
            }
        }
        foods = foodsList;

        foodGroup.translation.x = -player.x + screenWidth/2;
        foodGroup.translation.y = -player.y + screenHeight/2;
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

function massToRadius(mass){
    return Math.sqrt(mass / Math.PI) * 10;
}

function drawFood(food) {
    if(!foodObjects.hasOwnProperty(food.id)){
        var f = two.makeCircle(food.x, food.y, massToRadius(foodConfig.mass));
        f.fill = food.color.fill;
        f.stroke = food.color.stroke;
        f.linewidth = 0.25;
        foodObjects[food.id] = f;
        // f.id = food.id;
        f.addTo(foodGroup);
    }
}

function drawEnemy(enemy) {

    // var fontSize = (massToRadius(enemy.mass) / 2);

}

var $window = $(window).bind('mousemove', function(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    target.x = e.clientX - screenWidth / 2;
    target.y = e.clientY - screenHeight / 2;
    shadow.offset.x = 5 * radius * (mouse.x - two.width / 2) / two.width;
    shadow.offset.y = 5 * radius * (mouse.y - two.height / 2) / two.height;
})
.bind('touchstart', function() {
    e.preventDefault();
    return false;
})
.bind('touchmove', function(e) {
    e.preventDefault();
    var touch = e.originalEvent.changedTouches[0];
    mouse.x = touch.pageX;
    mouse.y = touch.pageY;
    shadow.offset.x = 5 * radius * (mouse.x - two.width / 2) / two.width;
    shadow.offset.y = 5 * radius * (mouse.y - two.height / 2) / two.height;
    return false;
});

two.bind('update', function() {
    if (!disconnected) {
        if (gameStart) {
            _.each(ball.vertices, function(v, i){
                var toMove = Math.sin(two.frameCount/10 + i);
                var toMovey = Math.cos(two.frameCount/10 + i);
                v.x = v.origin.x + (toMovey * (v.origin.x / 10)) / (ball.scale / 2);
                v.y = v.origin.y + (toMove * (v.origin.y / 10)) / (ball.scale / 2);
            });

            displayName.translation.x = ball.getBoundingClientRect().left + (ball.getBoundingClientRect().width / 2) - displayName.getBoundingClientRect().width / 2;
            displayName.translation.y = ball.getBoundingClientRect().top + (ball.getBoundingClientRect().height / 2) - displayName.getBoundingClientRect().height / 2;

            foods.forEach(function(f){ drawFood(f); });
    
            for (i = 0; i < enemies.length; i++) {
                if (enemies[i].id != player.id) {
                    drawEnemy(enemies[i]);
                }
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