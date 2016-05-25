var io = require('socket.io-client');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var constants = require('./constants');

var playerName;
var playerType;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;

var debug = function(args) {
    if (console && console.log) {
        console.log(args);
    }
};

debug(constants);

if ( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ) {
    constants.mobile = true;
}

function startGame(type) {
    constants.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0,25);
    constants.playerType = type;

    constants.screenWidth = window.innerWidth;
    constants.screenHeight = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    if (!socket) {
        socket = io({query:"type=" + type});
        setupSocket(socket);
    }
    if (!constants.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.chat.socket = socket;
    window.canvas.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function() {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectate');
    };

    btn.onclick = function () {

        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
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

        if (key === constants.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// TODO: Break out into GameControls.

var foodConfig = {
    border: 0,
};

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: constants.screenWidth / 2,
    y: constants.screenHeight / 2,
    screenWidth: constants.screenWidth,
    screenHeight: constants.screenHeight,
    target: {x: constants.screenWidth / 2, y: constants.screenHeight / 2}
};

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = {x: player.x, y: player.y};

var canvasParams = {
    target: target,
    socket: socket,
};

window.canvas = new Canvas(canvasParams);

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = toggleContinuity;

var continuitySetting = document.getElementById('roundFood');
continuitySetting.onchange = toggleRoundFood;

var c = window.canvas.cv;
var graph = c.getContext('2d');

var chatParams = {
    canvas: c,
    socket: socket,
    mobile: constants.mobile,
    player: player,
};

window.chat = new ChatClient(chatParams);

$( "#feed" ).click(function() {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$( "#split" ).click(function() {
    socket.emit('2');
    window.canvas.reenviar = false;
});

function checkLatency() {
    // Ping.
    constants.startPingTime = Date.now();
    socket.emit('ping');
}

function toggleDarkMode() {
    var LIGHT = '#f2fbff',
        DARK = '#181818';
    var LINELIGHT = '#000000',
        LINEDARK = '#ffffff';

    if (constants.backgroundColor === LIGHT) {
        constants.backgroundColor = DARK;
        constants.lineColor = LINEDARK;
        window.chat.addSystemLine('Dark mode enabled.');
    } else {
        constants.backgroundColor = LIGHT;
        constants.lineColor = LINELIGHT;
        window.chat.addSystemLine('Dark mode disabled.');
    }
}

function toggleBorder() {
    if (!constants.borderDraw) {
        constants.borderDraw = true;
        window.chat.addSystemLine('Showing border.');
    } else {
        constants.borderDraw = false;
        window.chat.addSystemLine('Hiding border.');
    }
}

function toggleMass() {
    if (constants.toggleMassState === 0) {
        constants.toggleMassState = 1;
        window.chat.addSystemLine('Viewing mass enabled.');
    } else {
        constants.toggleMassState = 0;
        window.chat.addSystemLine('Viewing mass disabled.');
    }
}

function toggleContinuity() {
    if (!constants.continuity) {
        constants.continuity = true;
        window.chat.addSystemLine('Continuity enabled.');
    } else {
        constants.continuity = false;
        window.chat.addSystemLine('Continuity disabled.');
    }
}

function toggleRoundFood(args) {
    if (args || constants.foodSides < 10) {
        constants.foodSides = (args && !isNaN(args[0]) && +args[0] >= 3) ? +args[0] : 10;
        window.chat.addSystemLine('Food is now rounded!');
    } else {
        constants.foodSides = 5;
        window.chat.addSystemLine('Food is no longer rounded!');
    }
}

// TODO: Break out many of these GameControls into separate classes.

window.chat.registerCommand('ping', 'Check your latency.', function () {
    checkLatency();
});

window.chat.registerCommand('dark', 'Toggle dark mode.', function () {
    toggleDarkMode();
});

window.chat.registerCommand('border', 'Toggle visibility of border.', function () {
    toggleBorder();
});

window.chat.registerCommand('mass', 'Toggle visibility of mass.', function () {
    toggleMass();
});

window.chat.registerCommand('continuity', 'Toggle continuity.', function () {
    toggleContinuity();
});

window.chat.registerCommand('roundfood', 'Toggle food drawing.', function (args) {
    toggleRoundFood(args);
});

window.chat.registerCommand('help', 'Information about the chat commands.', function () {
    chat.printHelp();
});

window.chat.registerCommand('login', 'Login as an admin.', function (args) {
    socket.emit('pass', args);
});

window.chat.registerCommand('kick', 'Kick a player, for admins only.', function (args) {
    socket.emit('kick', args);
});


// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pong', function () {
        var latency = Date.now() - constants.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_failed', function () {
        socket.close();
        constants.disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        constants.disconnected = true;
    });

    // Handle connection.
    socket.on('welcome', function (playerSettings) {
        player = playerSettings;
        player.name = playerName;
        player.screenWidth = constants.screenWidth;
        player.screenHeight = constants.screenHeight;
        player.target = window.canvas.target;
        window.chat.player = player;
        socket.emit('gotit', player);
        constants.gameStart = true;
        debug('Game started at: ' + constants.gameStart);
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (constants.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
		c.focus();
    });

    socket.on('gameSetup', function(data) {
        constants.gameWidth = data.gameWidth;
        constants.gameHeight = data.gameHeight;
        resize();
    });

    socket.on('playerDied', function (data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> was eaten.');
    });

    socket.on('playerDisconnect', function (data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', function (data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> joined.');
    });

    socket.on('leaderboard', function (data) {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id){
                if(leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed cell</span>";
            } else {
                if(leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name;
                else
                    status += (i + 1) + '. An unnamed cell';
            }
        }
        //status += '<br />Players: ' + data.players;
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (userData, foodsList, massList, virusList) {
        var playerData;
        for(var i =0; i< userData.length; i++) {
            if(typeof(userData[i].id) == "undefined") {
                playerData = userData[i];
                i = userData.length;
            }
        }
        if(playerType == 'player') {
            var xoffset = player.x - playerData.x;
            var yoffset = player.y - playerData.y;

            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            player.xoffset = isNaN(xoffset) ? 0 : xoffset;
            player.yoffset = isNaN(yoffset) ? 0 : yoffset;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    // Death.
    socket.on('RIP', function () {
        constants.gameStart = false;
        constants.died = true;
        window.setTimeout(function() {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            constants.died = false;
            if (constants.animLoopHandle) {
                window.cancelAnimationFrame(constants.animLoopHandle);
                constants.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (data) {
        constants.gameStart = false;
        reason = data;
        constants.kicked = true;
        socket.close();
    });

    socket.on('virusSplit', function (virusCell) {
        socket.emit('2', virusCell);
        reenviar = false;
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
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.lineWidth = foodConfig.border;
    drawCircle(food.x - player.x + constants.screenWidth / 2,
               food.y - player.y + constants.screenHeight / 2,
               food.radius, constants.foodSides);
}

function drawVirus(virus) {
    graph.strokeStyle = virus.stroke;
    graph.fillStyle = virus.fill;
    graph.lineWidth = virus.strokeWidth;
    drawCircle(virus.x - player.x + constants.screenWidth / 2,
               virus.y - player.y + constants.screenHeight / 2,
               virus.radius, constants.virusSides);
}

function drawFireFood(mass) {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border+10;
    drawCircle(mass.x - player.x + constants.screenWidth / 2,
               mass.y - player.y + constants.screenHeight / 2,
               mass.radius-5, 18 + (~~(mass.masa/5)));
}

function drawPlayers(order) {
    var start = {
        x: player.x - (constants.screenWidth / 2),
        y: player.y - (constants.screenHeight / 2)
    };

    for(var z=0; z<order.length; z++)
    {
        var userCurrent = users[order[z].nCell];
        var cellCurrent = users[order[z].nCell].cells[order[z].nDiv];

        var x=0;
        var y=0;

        var points = 30 + ~~(cellCurrent.mass/5);
        var increase = Math.PI * 2 / points;

        graph.strokeStyle = 'hsl(' + userCurrent.hue + ', 100%, 45%)';
        graph.fillStyle = 'hsl(' + userCurrent.hue + ', 100%, 50%)';
        graph.lineWidth = playerConfig.border;

        var xstore = [];
        var ystore = [];

        constants.spin += 0.0;

        var circle = {
            x: cellCurrent.x - start.x,
            y: cellCurrent.y - start.y
        };

        for (var i = 0; i < points; i++) {

            x = cellCurrent.radius * Math.cos(constants.spin) + circle.x;
            y = cellCurrent.radius * Math.sin(constants.spin) + circle.y;
            if(typeof(userCurrent.id) == "undefined") {
                x = valueInRange(-userCurrent.x + constants.screenWidth / 2,
                                 constants.gameWidth - userCurrent.x + constants.screenWidth / 2, x);
                y = valueInRange(-userCurrent.y + constants.screenHeight / 2,
                                 constants.gameHeight - userCurrent.y + constants.screenHeight / 2, y);
            } else {
                x = valueInRange(-cellCurrent.x - player.x + constants.screenWidth / 2 + (cellCurrent.radius/3),
                                 constants.gameWidth - cellCurrent.x + constants.gameWidth - player.x + constants.screenWidth / 2 - (cellCurrent.radius/3), x);
                y = valueInRange(-cellCurrent.y - player.y + constants.screenHeight / 2 + (cellCurrent.radius/3),
                                 constants.gameHeight - cellCurrent.y + constants.gameHeight - player.y + constants.screenHeight / 2 - (cellCurrent.radius/3) , y);
            }
            constants.spin += increase;
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
        var nameCell = "";
        if(typeof(userCurrent.id) == "undefined")
            nameCell = player.name;
        else
            nameCell = userCurrent.name;

        var fontSize = Math.max(cellCurrent.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';

        if (constants.toggleMassState === 0) {
            graph.strokeText(nameCell, circle.x, circle.y);
            graph.fillText(nameCell, circle.x, circle.y);
        } else {
            graph.strokeText(nameCell, circle.x, circle.y);
            graph.fillText(nameCell, circle.x, circle.y);
            graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            if(nameCell.length === 0) fontSize = 0;
            graph.strokeText(Math.round(cellCurrent.mass), circle.x, circle.y+fontSize);
            graph.fillText(Math.round(cellCurrent.mass), circle.x, circle.y+fontSize);
        }
    }
}

function valueInRange(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

function drawgrid() {
     graph.lineWidth = 1;
     graph.strokeStyle = constants.lineColor;
     graph.globalAlpha = 0.15;
     graph.beginPath();

    for (var x = constants.xoffset - player.x; x < constants.screenWidth; x += constants.screenHeight / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, constants.screenHeight);
    }

    for (var y = constants.yoffset - player.y ; y < constants.screenHeight; y += constants.screenHeight / 18) {
        graph.moveTo(0, y);
        graph.lineTo(constants.screenWidth, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
}

function drawborder() {
    graph.lineWidth = 1;
    graph.strokeStyle = playerConfig.borderColor;

    // Left-vertical.
    if (player.x <= constants.screenWidth/2) {
        graph.beginPath();
        graph.moveTo(constants.screenWidth/2 - player.x, 0 ? player.y > constants.screenHeight/2 : constants.screenHeight/2 - player.y);
        graph.lineTo(constants.screenWidth/2 - player.x, constants.gameHeight + constants.screenHeight/2 - player.y);
        graph.strokeStyle = constants.lineColor;
        graph.stroke();
    }

    // Top-horizontal.
    if (player.y <= constants.screenHeight/2) {
        graph.beginPath();
        graph.moveTo(0 ? player.x > constants.screenWidth/2 : constants.screenWidth/2 - player.x, constants.screenHeight/2 - player.y);
        graph.lineTo(constants.gameWidth + constants.screenWidth/2 - player.x, constants.screenHeight/2 - player.y);
        graph.strokeStyle = constants.lineColor;
        graph.stroke();
    }

    // Right-vertical.
    if (constants.gameWidth - player.x <= constants.screenWidth/2) {
        graph.beginPath();
        graph.moveTo(constants.gameWidth + constants.screenWidth/2 - player.x,
                     constants.screenHeight/2 - player.y);
        graph.lineTo(constants.gameWidth + constants.screenWidth/2 - player.x,
                     constants.gameHeight + constants.screenHeight/2 - player.y);
        graph.strokeStyle = constants.lineColor;
        graph.stroke();
    }

    // Bottom-horizontal.
    if (constants.gameHeight - player.y <= constants.screenHeight/2) {
        graph.beginPath();
        graph.moveTo(constants.gameWidth + constants.screenWidth/2 - player.x,
                     constants.gameHeight + constants.screenHeight/2 - player.y);
        graph.lineTo(constants.screenWidth/2 - player.x,
                     constants.gameHeight + constants.screenHeight/2 - player.y);
        graph.strokeStyle = constants.lineColor;
        graph.stroke();
    }
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
    constants.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (constants.died) {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, constants.screenWidth, constants.screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        graph.fillText('You died!', constants.screenWidth / 2, constant.screenHeight / 2);
    }
    else if (!constants.disconnected) {
        if (constants.gameStart) {
            graph.fillStyle = constants.backgroundColor;
            graph.fillRect(0, 0, constants.screenWidth, constants.screenHeight);

            drawgrid();
            foods.forEach(drawFood);
            fireFood.forEach(drawFireFood);
            viruses.forEach(drawVirus);

            if (constants.borderDraw) {
                drawborder();
            }
            var orderMass = [];
            for(var i=0; i<users.length; i++) {
                for(var j=0; j<users[i].cells.length; j++) {
                    orderMass.push({
                        nCell: i,
                        nDiv: j,
                        mass: users[i].cells[j].mass
                    });
                }
            }
            orderMass.sort(function(obj1, obj2) {
                return obj1.mass - obj2.mass;
            });

            drawPlayers(orderMass);
            socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".

        } else {
            graph.fillStyle = '#333333';
            graph.fillRect(0, 0, constants.screenWidth, constants.screenHeight);

            graph.textAlign = 'center';
            graph.fillStyle = '#FFFFFF';
            graph.font = 'bold 30px sans-serif';
            graph.fillText('Game Over!', constants.screenWidth / 2, constants.screenHeight / 2);
        }
    } else {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, constants.screenWidth, constants.screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        if (constants.kicked) {
            if (reason !== '') {
                graph.fillText('You were kicked for:', constants.screenWidth / 2, constants.screenHeight / 2 - 20);
                graph.fillText(reason, constants.screenWidth / 2, constants.screenHeight / 2 + 20);
            }
            else {
                graph.fillText('You were kicked!', constants.screenWidth / 2, constants.screenHeight / 2);
            }
        }
        else {
              graph.fillText('Disconnected!', constants.screenWidth / 2, constants.screenHeight / 2);
        }
    }
}

window.addEventListener('resize', resize);

function resize() {
    player.screenWidth = c.width = constants.screenWidth = playerType == 'player' ? window.innerWidth : constants.gameWidth;
    player.screenHeight = c.height = constants.screenHeight = playerType == 'player' ? window.innerHeight : constants.gameHeight;
    socket.emit('windowResized', { screenWidth: constants.screenWidth, screenHeight: constants.screenHeight });
}
