var io = require('socket.io-client');

var playerName;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;
var KEY_ENTER = 13;
var borderDraw = false;
var animLoopHandle;
var spin = -Math.PI;
var enemySpin = -Math.PI;

var debug = function(args) {
    if (console && console.log) {
        console.log(args);
    }
};

function startGame() {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '');
    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    if (!socket) {
        socket = io();
        setupSocket(socket);
    }
    if (!animLoopHandle)
        animloop();
    socket.emit('respawn');
}

// check if nick is valid alphanumeric characters (and underscores)
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function() {

    var btn = document.getElementById('startButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btn.onclick = function () {

        // check if the nick is valid
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame();
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');
    var instructions = document.getElementById('instructions');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame();
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// Canvas
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

// defaults
// TODO break out into GameControls
var continuity = false;
var startPingTime = 0;
var toggleMassState = 0;
var backgroundColor = '#f2fbff';

var foodConfig = {
    border: 0,
    borderColor: '#f39c12',
    fillColor: '#f1c40f'
};

var playerConfig = {
    border: 6,
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
    target: {x: screenWidth / 2, y: screenHeight / 2}
};

var foods = [];
var enemies = [];
var leaderboard = [];
var target = {x: player.x, y: player.y};

var c = document.getElementById('cvs');
c.addEventListener('mousemove', gameInput, false);
c.width = screenWidth; c.height = screenHeight;
c.addEventListener('mouseout', outOfBounds, false);

// register when the mouse goes off the canvas
function outOfBounds() {
    if (!continuity) {
        target = { x : 0, y: 0 };
    }
}

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = toggleContinuity;

var graph = c.getContext('2d');

function ChatClient(config) {
    this.commands = {};
    var input = document.getElementById('chatInput');
    input.addEventListener('keypress', this.sendChat.bind(this));
}

/** template into chat box a new message from a player */
ChatClient.prototype.addChatLine = function (name, message) {
    var newline = document.createElement('li');

    // color the chat input appropriately
    newline.className = (name === player.name) ? 'me' : 'friend';
    newline.innerHTML = '<b>' + name + '</b>: ' + message;

    this.appendMessage(newline);
};


/** template into chat box a new message from the application */
ChatClient.prototype.addSystemLine = function (message) {
    var newline = document.createElement('li');

    // message will appear in system color
    newline.className = 'system';
    newline.innerHTML = message;

    // place in message log
    this.appendMessage(newline);
};

/** templates the message DOM node into the messsage area */
ChatClient.prototype.appendMessage = function (node) {
    var chatList = document.getElementById('chatList');
    if (chatList.childNodes.length > 10) {
        chatList.removeChild(chatList.childNodes[0]);
    }
    chatList.appendChild(node);
};

/** sends a message or executes a command on the ENTER key */
ChatClient.prototype.sendChat = function (key) {
    var commands = this.commands,
        input = document.getElementById('chatInput');

    key = key.which || key.keyCode;

    if (key === KEY_ENTER) {
        var text = input.value.replace(/(<([^>]+)>)/ig,'');
        if (text !== '') {

            // this is a chat command
            if (text.indexOf('-') === 0) {
                var args = text.substring(1).split(' ');
                if (commands[args[0]]) {
                    commands[args[0]].callback(args.slice(1));
                } else {
                    this.addSystemLine('Unrecoginised Command: ' + text + ', type -help for more info');
                }

            // just a regular message - send along to server
            } else {
                socket.emit('playerChat', { sender: player.name, message: text });
                this.addChatLine(player.name, text);
            }

            // reset input
            input.value = '';
        }
    }
};

/** add a new chat command */
ChatClient.prototype.registerCommand = function (name, description, callback) {
    this.commands[name] = {
        description: description,
        callback: callback
    };
};

/** print help of all chat commands available */
ChatClient.prototype.printHelp = function () {
    var commands = this.commands;
    for (var cmd in commands) {
        if (commands.hasOwnProperty(cmd)) {
            this.addSystemLine('-' + cmd + ': ' + commands[cmd].description);
        }
    }
};

var chat = new ChatClient();

// chat command callback functions
function checkLatency() {
    // Ping
    startPingTime = Date.now();
    socket.emit('ping');
}

function toggleDarkMode() {
    var LIGHT = '#f2fbff',
        DARK = '#181818';

    if (backgroundColor === LIGHT) {
        backgroundColor = DARK;
        chat.addSystemLine('Dark mode enabled');
    } else {
        backgroundColor = LIGHT;
        chat.addSystemLine('Dark mode disabled');
    }
}

function toggleBorder(args) {
    if (!borderDraw) {
        borderDraw = true;
        chat.addSystemLine('Showing border');
    } else {
        borderDraw = false;
        chat.addSystemLine('Hiding border');
    }
}

function toggleMass(args) {
    if (toggleMassState === 0) {
        toggleMassState = 1;
        chat.addSystemLine('Mass mode activated!');
    } else {
        toggleMassState = 0;
        chat.addSystemLine('Mass mode deactivated!');
    }
}

function toggleContinuity(args) {
    if (!continuity) {
        continuity = true;
        chat.addSystemLine('Continuity activated!');
    } else {
        continuity = false;
        chat.addSystemLine('Continuity deactivated!');
    }
}

// TODO
// Break out many of these game controls into a separate class

chat.registerCommand('ping', 'Check your latency', function () {
    checkLatency();
});

chat.registerCommand('dark', 'Toggle dark mode', function () {
    toggleDarkMode();
});

chat.registerCommand('border', 'Toggle border', function () {
    toggleBorder();
});

chat.registerCommand('mass', 'View mass', function () {
    toggleMass();
});

chat.registerCommand('continuity', 'Toggle continuity', function () {
    toggleContinuity();
});

chat.registerCommand('help', 'Chat commands information', function () {
    chat.printHelp();
});

chat.registerCommand('login', 'Login as an admin', function (args) {
    socket.emit('pass', args);
});

chat.registerCommand('kick', 'Kick a player', function (args) {
    socket.emit('kick', args);
});


// socket stuff
function setupSocket(socket) {
    // Handle ping
    socket.on('pong', function () {
        var latency = Date.now() - startPingTime;
        debug('Latency: ' + latency + 'ms');
        chat.addSystemLine('Ping: ' + latency + 'ms');
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
        player.target = target;
        socket.emit('gotit', player);
        gameStart = true;
        debug('Game is started: ' + gameStart);
        chat.addSystemLine('Connected to the game!');
        chat.addSystemLine('Type <b>-help</b> for a list of commands');
        document.getElementById('chatInput').select();
    });

    socket.on('gameSetup', function(data) {
        gameWidth = data.gameWidth;
        gameHeight = data.gameHeight;
    });

    socket.on('playerDied', function (data) {
        chat.addSystemLine('Player <b>' + data.name + '</b> died!');
    });

    socket.on('playerDisconnect', function (data) {
        chat.addSystemLine('Player <b>' + data.name + '</b> disconnected!');
    });

    socket.on('playerJoin', function (data) {
        chat.addSystemLine('Player <b>' + data.name + '</b> joined!');
    });

    socket.on('leaderboard', function (data) {
        leaderboard = data.leaderboard;
        var status = 'Players: ' + data.players;
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id)
                status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
            else
                status += (i + 1) + '. ' + leaderboard[i].name;
        }
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        chat.addSystemLine(data);
    });

    // Chat
    socket.on('serverSendPlayerChat', function (data) {
        chat.addChatLine(data.sender, data.message);
    });

    // Handle movement
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList) {
        var xoffset = player.x - playerData.x;
        var yoffset = player.y - playerData.y;

        player.x = playerData.x;
        player.y = playerData.y;
        player.mass = playerData.mass;
        player.radius = playerData.radius;
        player.xoffset = isNaN(xoffset) ? 0 : xoffset;
        player.yoffset = isNaN(yoffset) ? 0 : yoffset;

        enemies = userData;
        foods = foodsList;
    });

    // Die
    socket.on('RIP', function () {
        gameStart = false;
        died = true;
        window.setTimeout(function() {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            died = false;
            if (animLoopHandle) {
                window.cancelAnimationFrame(animLoopHandle);
                animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (data) {
        gameStart = false;
        reason = data;
        kicked = true;
        socket.close();
    });
}

function drawCircle(centerX, centerY, radius, sides) {
    var theta = 0;
    var x = 0;
    var y = 0;

    graph.beginPath();

    for (var i = 0; i < sides; i++) {
        theta = (i / sides) * 2 * Math.PI;
        x = centerX + radius * Math.sin(theta);
        y = centerY + radius * Math.cos(theta);
        graph.lineTo(x, y);
    }

    graph.closePath();
    graph.stroke();
    graph.fill();
}

function drawFood(food) {
    graph.strokeStyle = food.color.border || foodConfig.borderColor;
    graph.fillStyle = food.color.fill || foodConfig.fillColor;
    graph.lineWidth = foodConfig.border;
    drawCircle(food.x - player.x + screenWidth / 2, food.y - player.y + screenHeight / 2, food.radius, 9);
}

function drawPlayer() {
    var x = 0;
    var y = 0;
    var circle = {
        x: screenWidth / 2,
        y: screenHeight / 2
    };
    var points = 30 + ~~(player.mass/5);
    var increase = Math.PI * 2 / points;

    graph.strokeStyle = 'hsl(' + player.hue + ', 80%, 40%)';
    graph.fillStyle = 'hsl(' + player.hue + ', 70%, 50%)';
    graph.lineWidth = playerConfig.border;

    var xstore = [];
    var ystore = [];

    spin += 0.0;

    for (var i = 0; i < points; i++) {

        x = player.radius * Math.cos(spin) + circle.x;
        y = player.radius * Math.sin(spin) + circle.y;
        x = valueInRange(-player.x + screenWidth / 2, gameWidth - player.x + screenWidth / 2, x);
        y = valueInRange(-player.y + screenHeight / 2, gameHeight - player.y + screenHeight / 2, y);

        spin += increase;



        xstore[i] = x;
        ystore[i] = y;

    }
    /*if (wiggle >= player.radius/ 3) inc = -1;
     *if (wiggle <= player.radius / -3) inc = +1;
     *wiggle += inc;
     */
    for (i = 0; i < points; ++i) {
        if (i === 0) {
            graph.beginPath();
            graph.moveTo(xstore[i], ystore[i]);
        } else if (i > 0 && i < points - 1) {
            graph.lineTo(xstore[i], ystore[i]);
        } else {
            graph.lineTo(xstore[i], ystore[i]);
            graph.lineTo(xstore[0], ystore[0]);
        }

    }
    graph.lineJoin = 'round';
    graph.lineCap = 'round';
    graph.fill();
    graph.stroke();




    var fontSize = (player.radius / 2);
    graph.lineWidth = playerConfig.textBorderSize;
    graph.miterLimit = 1;
    graph.lineJoin = 'round';
    graph.textAlign = 'center';
    graph.fillStyle = playerConfig.textColor;
    graph.textBaseline = 'middle';
    graph.strokeStyle = playerConfig.textBorder;
    graph.font = 'bold ' + fontSize + 'px sans-serif';

    if (toggleMassState === 0) {
        graph.strokeText(player.name, screenWidth / 2, screenHeight / 2);
        graph.fillText(player.name, screenWidth / 2, screenHeight / 2);
    } else {
        graph.strokeText(player.name + ' (' + player.mass + ')', screenWidth / 2, screenHeight / 2);
        graph.fillText(player.name + ' (' + player.mass + ')', screenWidth / 2, screenHeight / 2);
    }
}

function valueInRange(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

function drawEnemy(enemy) {
        var x = 0;
        var y = 0;
        var circle = {
            x: enemy.x - player.x + screenWidth / 2,
            y: enemy.y - player.y + screenHeight / 2
        };

        var points = 30 + ~~(enemy.mass / 5);
        var increase = Math.PI * 2 / points;

        graph.strokeStyle = 'hsl(' + enemy.hue + ', 80%, 40%)';
        graph.fillStyle = 'hsl(' + enemy.hue + ', 70%, 50%)';
        graph.lineWidth = enemyConfig.border;

        var xstore = [];
        var ystore = [];

        enemySpin += 0.0;

        for (var i = 0; i < points; i++) {

            x = enemy.radius * Math.cos(enemySpin) + circle.x;
            y = enemy.radius * Math.sin(enemySpin) + circle.y;

            x = valueInRange(-enemy.x - player.x + screenWidth/2 + (enemy.radius/3), gameWidth - enemy.x + gameWidth - player.x + screenWidth/2 - (enemy.radius/3), x);
            y = valueInRange(-enemy.y - player.y + screenHeight/2 + (enemy.radius/3), gameHeight - enemy.y + gameHeight - player.y + screenHeight/2 - (enemy.radius/3) , y);

            enemySpin += increase;

            xstore[i] = x;
            ystore[i] = y;

        }

        for (i = 0; i < points; ++i) {
            if (i === 0) {
                graph.beginPath();
                graph.moveTo(xstore[i], ystore[i]);
            } else if (i > 0 && i < points - 1) {
                graph.lineTo(xstore[i], ystore[i]);
            } else {
                graph.lineTo(xstore[i], ystore[i]);
                graph.lineTo(xstore[0], ystore[0]);
            }

        }
        graph.lineJoin = 'round';
        graph.lineCap = 'round';
        graph.fill();
        graph.stroke();

        var fontSize = (enemy.radius / 2);
        graph.lineWidth = enemyConfig.textBorderSize;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.fillStyle = enemyConfig.textColor;
        graph.textBaseline = 'middle';
        graph.strokeStyle = enemyConfig.textBorder;
        graph.font = 'bold ' + fontSize + 'px sans-serif';

        if (toggleMassState === 0) {
            graph.strokeText(enemy.name, circle.x, circle.y);
            graph.fillText(enemy.name, circle.x, circle.y);
        } else {
            graph.strokeText(enemy.name + ' (' + enemy.mass + ')', circle.x, circle.y);
            graph.fillText(enemy.name + ' (' + enemy.mass + ')', circle.x, circle.y);
        }
    }

function drawgrid() {
     graph.lineWidth = 1;
     graph.strokeStyle = '#000';
     graph.globalAlpha = 0.15;
     graph.beginPath();

    for (var x = xoffset - player.x; x < screenWidth; x += screenHeight / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screenHeight);
    }

    for (var y = yoffset - player.y ; y < screenHeight; y += screenHeight / 18) {
        graph.moveTo(0, y);
        graph.lineTo(screenWidth, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
}

function drawborder() {
    graph.strokeStyle = playerConfig.borderColor;

    // Left-vertical
    if (player.x <= screenWidth/2) {
        graph.beginPath();
        graph.moveTo(screenWidth/2 - player.x, 0 ? player.y > screenHeight/2 : screenHeight/2 - player.y);
        graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = '#000000';
        graph.stroke();
    }

    // Top-horizontal
    if (player.y <= screenHeight/2) {
        graph.beginPath();
        graph.moveTo(0 ? player.x > screenWidth/2 : screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.lineTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.strokeStyle = '#000000';
        graph.stroke();
    }

    // Right-vertical
    if (gameWidth - player.x <= screenWidth/2) {
        graph.beginPath();
        graph.moveTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.lineTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = '#000000';
        graph.stroke();
    }

    // Bottom-horizontal
    if (gameHeight - player.y <= screenHeight/2) {
        graph.beginPath();
        graph.moveTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = '#000000';
        graph.stroke();
    }
}

function gameInput(mouse) {
    target.x = mouse.clientX - screenWidth / 2;
    target.y = mouse.clientY - screenHeight / 2;
}

window.requestAnimFrame = (function() {
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.msRequestAnimationFrame     ||
            function( callback ) {
                window.setTimeout(callback, 1000 / 60);
            };
})();

window.cancelAnimFrame = (function(handle) {
    return  window.cancelAnimationFrame     ||
            window.mozCancelAnimationFrame;
})();

function animloop() {
    animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (died) {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, screenWidth, screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        graph.fillText('You died!', screenWidth / 2, screenHeight / 2);
    }
    else if (!disconnected) {
        if (gameStart) {
            graph.fillStyle = backgroundColor;
            graph.fillRect(0, 0, screenWidth, screenHeight);
            drawgrid();

            foods.forEach(function(food) {
                drawFood(food);
            });

            if (borderDraw) {
                drawborder();
            }

            for (var i = 0; i < enemies.length; i++) {
                if (enemies[i].mass <= player.mass) 
                    drawEnemy(enemies[i]);
            }

            drawPlayer();

            for (var j = 0; j < enemies.length; j++) {
                if (enemies[j].mass > player.mass) 
                    drawEnemy(enemies[j]);
            }

            socket.emit('0', target); // playerSendTarget Heartbeat

        } else {
            graph.fillStyle = '#333333';
            graph.fillRect(0, 0, screenWidth, screenHeight);

            graph.textAlign = 'center';
            graph.fillStyle = '#FFFFFF';
            graph.font = 'bold 30px sans-serif';
            graph.fillText('Game Over!', screenWidth / 2, screenHeight / 2);
        }
    } else {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, screenWidth, screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        if (kicked) {
            if (reason !== '') {
                graph.fillText('You were kicked for reason:', screenWidth / 2, screenHeight / 2 - 20);
                graph.fillText(reason, screenWidth / 2, screenHeight / 2 + 20);
            }
            else {
                graph.fillText('You were kicked!', screenWidth / 2, screenHeight / 2);
            }
        }
        else {
              graph.fillText('Disconnected!', screenWidth / 2, screenHeight / 2);
        }
    }
}

window.addEventListener('resize', function() {
    player.screenWidth = c.width = screenWidth = window.innerWidth;
    player.screenHeight = c.height = screenHeight = window.innerHeight;
    socket.emit('windowResized', { screenWidth: screenWidth, screenHeight: screenHeight });
}, true);
