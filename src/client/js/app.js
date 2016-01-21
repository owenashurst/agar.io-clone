var io = require('socket.io-client');

var playerName;
var playerType;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;
var KEY_ESC = 27;
var KEY_ENTER = 13;
var KEY_CHAT = 13;
var KEY_FIREFOOD = 119;
var KEY_SPLIT = 32;
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var borderDraw = false;
var animLoopHandle;
var spin = -Math.PI;
var enemySpin = -Math.PI;
var mobile = false;
var foodSides = 10;
var virusSides = 20;

var debug = function(args) {
    if (console && console.log) {
        console.log(args);
    }
};

if ( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ) {
    mobile = true;
}

function startGame(type) {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0,25);
    playerType = type;

    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    if (!socket) {
        socket = io({query:"type=" + type});
        setupSocket(socket);
    }
    if (!animLoopHandle)
        animloop();
    socket.emit('respawn');
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

        if (key === KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// Canvas.
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

// TODO: Break out into GameControls.
var continuity = false;
var startPingTime = 0;
var toggleMassState = 0;
var backgroundColor = '#f2fbff';
var lineColor = '#000000';

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
    x: screenWidth / 2,
    y: screenHeight / 2,
    screenWidth: screenWidth,
    screenHeight: screenHeight,
    target: {x: screenWidth / 2, y: screenHeight / 2}
};

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = {x: player.x, y: player.y};
var reenviar = true;
var directionLock = false;
var directions = [];

var c = document.getElementById('cvs');
c.width = screenWidth; c.height = screenHeight;
c.addEventListener('mousemove', gameInput, false);
c.addEventListener('mouseout', outOfBounds, false);
c.addEventListener('keypress', keyInput, false);
c.addEventListener('keyup', function(event) {reenviar = true; directionUp(event);}, false);
c.addEventListener('keydown', directionDown, false);
c.addEventListener('touchstart', touchInput, false);
c.addEventListener('touchmove', touchInput, false);

// Register when the mouse goes off the canvas.
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

var continuitySetting = document.getElementById('roundFood');
continuitySetting.onchange = toggleRoundFood;

var graph = c.getContext('2d');

function ChatClient(config) {
    this.commands = {};
    var input = document.getElementById('chatInput');
    input.addEventListener('keypress', this.sendChat.bind(this));
    input.addEventListener('keyup', function(key) {
        input = document.getElementById('chatInput');

        key = key.which || key.keyCode;
        if (key === KEY_ESC) {
            input.value = '';
            c.focus();
        }
    });
}

// Chat box implementation for the users.
ChatClient.prototype.addChatLine = function (name, message, me) {
    if (mobile) {
        return;
    }
    var newline = document.createElement('li');

    // Colours the chat input correctly.
    newline.className = (me) ? 'me' : 'friend';
    newline.innerHTML = '<b>' + ((name.length < 1) ? 'An unnamed cell' : name) + '</b>: ' + message;

    this.appendMessage(newline);
};


// Chat box implementation for the system.
ChatClient.prototype.addSystemLine = function (message) {
    if (mobile) {
        return;
    }
    var newline = document.createElement('li');

    // Colours the chat input correctly.
    newline.className = 'system';
    newline.innerHTML = message;

    // Append messages to the logs.
    this.appendMessage(newline);
};

// Places the message DOM node into the chat box.
ChatClient.prototype.appendMessage = function (node) {
    if (mobile) {
        return;
    }
    var chatList = document.getElementById('chatList');
    if (chatList.childNodes.length > 10) {
        chatList.removeChild(chatList.childNodes[0]);
    }
    chatList.appendChild(node);
};

// Sends a message or executes a command on the click of enter.
ChatClient.prototype.sendChat = function (key) {
    var commands = this.commands,
        input = document.getElementById('chatInput');

    key = key.which || key.keyCode;

    if (key === KEY_ENTER) {
        var text = input.value.replace(/(<([^>]+)>)/ig,'');
        if (text !== '') {

            // Chat command.
            if (text.indexOf('-') === 0) {
                var args = text.substring(1).split(' ');
                if (commands[args[0]]) {
                    commands[args[0]].callback(args.slice(1));
                } else {
                    this.addSystemLine('Unrecognized Command: ' + text + ', type -help for more info.');
                }

            // Allows for regular messages to be sent to the server.
            } else {
                socket.emit('playerChat', { sender: player.name, message: text });
                this.addChatLine(player.name, text, true);
            }

            // Resets input.
            input.value = '';
            c.focus();
        }
    }
};

// Allows for addition of commands.
ChatClient.prototype.registerCommand = function (name, description, callback) {
    this.commands[name] = {
        description: description,
        callback: callback
    };
};

// Allows help to print the list of all the commands and their descriptions.
ChatClient.prototype.printHelp = function () {
    var commands = this.commands;
    for (var cmd in commands) {
        if (commands.hasOwnProperty(cmd)) {
            this.addSystemLine('-' + cmd + ': ' + commands[cmd].description);
        }
    }
};

var chat = new ChatClient();

// Chat command callback functions.
function keyInput(event) {
	var key = event.which || event.keyCode;
	if (key === KEY_FIREFOOD && reenviar) {
        socket.emit('1');
        reenviar = false;
    }
    else if (key === KEY_SPLIT && reenviar) {
       document.getElementById('split_cell').play();
        socket.emit('2');
        reenviar = false;
    }
    else if (key === KEY_CHAT) {
        document.getElementById('chatInput').focus();
    }
}

    $( "#feed" ).click(function() {
        socket.emit('1');
        reenviar = false;
});

    $( "#split" ).click(function() {
        socket.emit('2');
        reenviar = false;
});

// Function called when a key is pressed, will change direction if arrow key.
function directionDown(event) {
	var key = event.which || event.keyCode;

	if (directional(key)) {
		directionLock = true;
		if (newDirection(key,directions, true)) {
			updateTarget(directions);
			socket.emit('0', target);
		}
	}
}

// Function called when a key is lifted, will change direction if arrow key.
function directionUp(event) {
	var key = event.which || event.keyCode;
	if (directional(key)) {
		if (newDirection(key,directions, false)) {
			updateTarget(directions);
			if (directions.length === 0) directionLock = false;
			socket.emit('0', target);
		}
	}
}

// Updates the direction array including information about the new direction.
function newDirection(direction, list, isAddition) {
	var result = false;
	var found = false;
	for (var i = 0, len = list.length; i < len; i++) {
		if (list[i] == direction) {
			found = true;
			if (!isAddition) {
				result = true;
				// Removes the direction.
				list.splice(i, 1);
			}
			break;
		}
	}
	// Adds the direction.
	if (isAddition && found === false) {
		result = true;
		list.push(direction);
	}

	return result;
}

// Updates the target according to the directions in the directions array.
function updateTarget(list) {
	target = { x : 0, y: 0 };
	var directionHorizontal = 0;
	var directionVertical = 0;
	for (var i = 0, len = list.length; i < len; i++) {
		if (directionHorizontal === 0) {
			if (list[i] == KEY_LEFT) directionHorizontal -= Number.MAX_VALUE;
			else if (list[i] == KEY_RIGHT) directionHorizontal += Number.MAX_VALUE;
		}
		if (directionVertical === 0) {
			if (list[i] == KEY_UP) directionVertical -= Number.MAX_VALUE;
			else if (list[i] == KEY_DOWN) directionVertical += Number.MAX_VALUE;
		}
	}
	target.x += directionHorizontal;
	target.y += directionVertical;
}

function directional(key) {
	return horizontal(key) || vertical(key);
}

function horizontal(key) {
	return key == KEY_LEFT || key == KEY_RIGHT;
}

function vertical(key) {
	return key == KEY_DOWN || key == KEY_UP;
}
function checkLatency() {
    // Ping.
    startPingTime = Date.now();
    socket.emit('ping');
}

function toggleDarkMode() {
    var LIGHT = '#f2fbff',
        DARK = '#181818';
    var LINELIGHT = '#000000',
        LINEDARK = '#ffffff';

    if (backgroundColor === LIGHT) {
        backgroundColor = DARK;
        lineColor = LINEDARK;
        chat.addSystemLine('Dark mode enabled.');
    } else {
        backgroundColor = LIGHT;
        lineColor = LINELIGHT;
        chat.addSystemLine('Dark mode disabled.');
    }
}

function toggleBorder() {
    if (!borderDraw) {
        borderDraw = true;
        chat.addSystemLine('Showing border.');
    } else {
        borderDraw = false;
        chat.addSystemLine('Hiding border.');
    }
}

function toggleMass() {
    if (toggleMassState === 0) {
        toggleMassState = 1;
        chat.addSystemLine('Viewing mass enabled.');
    } else {
        toggleMassState = 0;
        chat.addSystemLine('Viewing mass disabled.');
    }
}

function toggleContinuity() {
    if (!continuity) {
        continuity = true;
        chat.addSystemLine('Continuity enabled.');
    } else {
        continuity = false;
        chat.addSystemLine('Continuity disabled.');
    }
}

function toggleRoundFood(args) {
    if (args || foodSides < 10) {
        foodSides = (args && !isNaN(args[0]) && +args[0] >= 3) ? +args[0] : 10;
        chat.addSystemLine('Food is now rounded!');
    } else {
        foodSides = 5;
        chat.addSystemLine('Food is no longer rounded!');
    }
}

// TODO: Break out many of these GameControls into separate classes.

chat.registerCommand('ping', 'Check your latency.', function () {
    checkLatency();
});

chat.registerCommand('dark', 'Toggle dark mode.', function () {
    toggleDarkMode();
});

chat.registerCommand('border', 'Toggle visibility of border.', function () {
    toggleBorder();
});

chat.registerCommand('mass', 'Toggle visibility of mass.', function () {
    toggleMass();
});

chat.registerCommand('continuity', 'Toggle continuity.', function () {
    toggleContinuity();
});

chat.registerCommand('roundfood', 'Toggle food drawing.', function (args) {
    toggleRoundFood(args);
});

chat.registerCommand('help', 'Information about the chat commands.', function () {
    chat.printHelp();
});

chat.registerCommand('login', 'Login as an admin.', function (args) {
    socket.emit('pass', args);
});

chat.registerCommand('kick', 'Kick a player, for admins only.', function (args) {
    socket.emit('kick', args);
});


// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pong', function () {
        var latency = Date.now() - startPingTime;
        debug('Latency: ' + latency + 'ms');
        chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_failed', function () {
        socket.close();
        disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        disconnected = true;
    });

    // Handle connection.
    socket.on('welcome', function (playerSettings) {
        player = playerSettings;
        player.name = playerName;
        player.screenWidth = screenWidth;
        player.screenHeight = screenHeight;
        player.target = target;
        socket.emit('gotit', player);
        gameStart = true;
        debug('Game started at: ' + gameStart);
        chat.addSystemLine('Connected to the game!');
        chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
		c.focus();
    });

    socket.on('gameSetup', function(data) {
        gameWidth = data.gameWidth;
        gameHeight = data.gameHeight;
        resize();
    });

    socket.on('playerDied', function (data) {
        chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> was eaten.');
    });

    socket.on('playerDisconnect', function (data) {
        chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', function (data) {
        chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> joined.');
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
        chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        chat.addChatLine(data.sender, data.message, false);
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
    drawCircle(food.x - player.x + screenWidth / 2, food.y - player.y + screenHeight / 2, food.radius, foodSides);
}

function drawVirus(virus) {
    graph.strokeStyle = virus.stroke;
    graph.fillStyle = virus.fill;
    graph.lineWidth = virus.strokeWidth;
    drawCircle(virus.x - player.x + screenWidth / 2, virus.y - player.y + screenHeight / 2, virus.radius, virusSides);
}

function drawFireFood(mass) {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border+10;
    drawCircle(mass.x - player.x + screenWidth / 2, mass.y - player.y + screenHeight / 2, mass.radius-5, 18 + (~~(mass.masa/5)));
}

function drawPlayers(order) {
    var start = {
        x: player.x - (screenWidth / 2),
        y: player.y - (screenHeight / 2)
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

        spin += 0.0;

        var circle = {
            x: cellCurrent.x - start.x,
            y: cellCurrent.y - start.y
        };

        for (var i = 0; i < points; i++) {

            x = cellCurrent.radius * Math.cos(spin) + circle.x;
            y = cellCurrent.radius * Math.sin(spin) + circle.y;
            if(typeof(userCurrent.id) == "undefined") {
                x = valueInRange(-userCurrent.x + screenWidth / 2, gameWidth - userCurrent.x + screenWidth / 2, x);
                y = valueInRange(-userCurrent.y + screenHeight / 2, gameHeight - userCurrent.y + screenHeight / 2, y);
            } else {
                x = valueInRange(-cellCurrent.x - player.x + screenWidth/2 + (cellCurrent.radius/3), gameWidth - cellCurrent.x + gameWidth - player.x + screenWidth/2 - (cellCurrent.radius/3), x);
                y = valueInRange(-cellCurrent.y - player.y + screenHeight/2 + (cellCurrent.radius/3), gameHeight - cellCurrent.y + gameHeight - player.y + screenHeight/2 - (cellCurrent.radius/3) , y);
            }
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

        if (toggleMassState === 0) {
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
     graph.strokeStyle = lineColor;
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
    graph.lineWidth = 1;
    graph.strokeStyle = playerConfig.borderColor;

    // Left-vertical.
    if (player.x <= screenWidth/2) {
        graph.beginPath();
        graph.moveTo(screenWidth/2 - player.x, 0 ? player.y > screenHeight/2 : screenHeight/2 - player.y);
        graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Top-horizontal.
    if (player.y <= screenHeight/2) {
        graph.beginPath();
        graph.moveTo(0 ? player.x > screenWidth/2 : screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.lineTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Right-vertical.
    if (gameWidth - player.x <= screenWidth/2) {
        graph.beginPath();
        graph.moveTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.lineTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Bottom-horizontal.
    if (gameHeight - player.y <= screenHeight/2) {
        graph.beginPath();
        graph.moveTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }
}

function gameInput(mouse) {
	if (!directionLock) {
		target.x = mouse.clientX - screenWidth / 2;
		target.y = mouse.clientY - screenHeight / 2;
	}
}

function touchInput(touch) {
    touch.preventDefault();
    touch.stopPropagation();
	if (!directionLock) {
		target.x = touch.touches[0].clientX - screenWidth / 2;
		target.y = touch.touches[0].clientY - screenHeight / 2;
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
            foods.forEach(drawFood);
            fireFood.forEach(drawFireFood);
            viruses.forEach(drawVirus);
            
            if (borderDraw) {
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
            orderMass.sort(function(obj1,obj2) {
                return obj1.mass - obj2.mass;
            });

            drawPlayers(orderMass);
            socket.emit('0', target); // playerSendTarget "Heartbeat".

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
                graph.fillText('You were kicked for:', screenWidth / 2, screenHeight / 2 - 20);
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

window.addEventListener('resize', resize);

function resize() {
    player.screenWidth = c.width = screenWidth = playerType == 'player' ? window.innerWidth : gameWidth;
    player.screenHeight = c.height = screenHeight = playerType == 'player' ? window.innerHeight : gameHeight;
    socket.emit('windowResized', { screenWidth: screenWidth, screenHeight: screenHeight });
}
