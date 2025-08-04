var io = require("socket.io-client");
var render = require("./render");
var ChatClient = require("./chat-client");
var Canvas = require("./canvas");
var global = require("./global");
var ConnectionMonitor = require("./connectionMonitor");

var playerNameInput = document.getElementById("playerNameInput");
var socket;
let lastServerUpdate = Date.now();
let interpolationFactor = 1;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}
let monitor;

function startGame(type) {
    global.playerName = playerNameInput.value
        .replace(/(<([^>]+)>)/gi, "")
        .substring(0, 25);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    document.getElementById("startMenuWrapper").style.maxHeight = "0px";
    document.getElementById("gameAreaWrapper").style.opacity = 1;
    if (!socket) {
        socket = io({ query: "type=" + type });
        monitor = new ConnectionMonitor(socket);

        setupSocket(socket);
    }
    if (!global.animLoopHandle) animloop();
    socket.emit("respawn");
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug("Regex Test", regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function () {
    var btn = document.getElementById("startButton"),
        btnS = document.getElementById("spectateButton"),
        nickErrorText = document.querySelector("#startMenu .input-error");

    btnS.onclick = function () {
        startGame("spectator");
    };

    btn.onclick = function () {
        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame("player");
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById("settingsButton");
    var settings = document.getElementById("settings");

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == "300px") {
            settings.style.maxHeight = "0px";
        } else {
            settings.style.maxHeight = "300px";
        }
    };

    playerNameInput.addEventListener("keypress", function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame("player");
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 6,
    textColor: "#FFFFFF",
    textBorder: "#000000",
    textBorderSize: 3,
    defaultSize: 30,
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 },
    targetX: global.screen.width / 2,
    targetY: global.screen.height / 2,
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
let previousUsers = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var visibleBorderSetting = document.getElementById("visBord");
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById("showMass");
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById("continuity");
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById("roundFood");
roundFoodSetting.onchange = settings.toggleRoundFood;

var c = window.canvas.cv;
var graph = c.getContext("2d");

$("#feed").click(function () {
    socket.emit("1");
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit("2");
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    socket.close();
    if (!global.kicked) {
        // We have a more specific error message
        render.drawErrorMessage("Disconnected!", graph, global.screen);
    }
}

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on("pongcheck", function () {
        var latency = Date.now() - global.startPingTime;
        debug("Latency: " + latency + "ms");
        window.chat.addSystemLine("Ping: " + latency + "ms");
    });

    // Handle error.
    socket.on("connect_error", handleDisconnect);
    socket.on("disconnect", handleDisconnect);

    // Handle connection.
    socket.on("welcome", function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        global.player = player;
        window.chat.player = player;
        socket.emit("gotit", player);
        global.gameStart = true;
        window.chat.addSystemLine("Connected to the game!");
        window.chat.addSystemLine("Type <b>-help</b> for a list of commands.");
        if (global.mobile) {
            document
                .getElementById("gameAreaWrapper")
                .removeChild(document.getElementById("chatbox"));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on("playerDied", (data) => {
        const player = isUnnamedCell(data.playerEatenName)
            ? "An unnamed cell"
            : data.playerEatenName;
        //const killer = isUnnamedCell(data.playerWhoAtePlayerName) ? 'An unnamed cell' : data.playerWhoAtePlayerName;

        //window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten by <b>' + (killer) + '</b>');
        window.chat.addSystemLine("{GAME} - <b>" + player + "</b> was eaten");
    });

    socket.on("playerDisconnect", (data) => {
        window.chat.addSystemLine(
            "{GAME} - <b>" +
                (isUnnamedCell(data.name) ? "An unnamed cell" : data.name) +
                "</b> disconnected."
        );
    });

    socket.on("playerJoin", (data) => {
        window.chat.addSystemLine(
            "{GAME} - <b>" +
                (isUnnamedCell(data.name) ? "An unnamed cell" : data.name) +
                "</b> joined."
        );
    });

    socket.on("leaderboard", (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += "<br />";
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0)
                    status +=
                        '<span class="me">' +
                        (i + 1) +
                        ". " +
                        leaderboard[i].name +
                        "</span>";
                else
                    status +=
                        '<span class="me">' +
                        (i + 1) +
                        ". An unnamed cell</span>";
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += i + 1 + ". " + leaderboard[i].name;
                else status += i + 1 + ". An unnamed cell";
            }
        }
        //status += '<br />Players: ' + data.players;
        document.getElementById("status").innerHTML = status;
    });

    socket.on("serverMSG", function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on("serverSendPlayerChat", function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on(
        "serverTellPlayerMove",
        function (playerData, userData, foodsList, massList, virusList) {
            if (global.playerType == "player") {
                player.targetX = playerData.x;
                player.targetY = playerData.y;
                player.hue = playerData.hue;
                player.massTotal = playerData.massTotal;
                player.cells = playerData.cells;
                if (typeof player.x !== "number" || isNaN(player.x))
                    player.x = player.targetX;
                if (typeof player.y !== "number" || isNaN(player.y))
                    player.y = player.targetY;
            }
            users = userData.map((newUser) => {
                const existingUser = users.find((u) => u.id === newUser.id);

                return {
                    ...newUser,
                    prevCells: existingUser
                        ? existingUser.cells
                        : newUser.cells,
                    cells: newUser.cells.map((newCell, i) => {
                        const existingCell = existingUser?.cells[i];
                        return {
                            ...newCell,
                            renderX: existingCell?.renderX ?? newCell.x,
                            renderY: existingCell?.renderY ?? newCell.y,
                            renderRadius:
                                existingCell?.renderRadius ?? newCell.radius,
                        };
                    }),
                };
            });

            lastServerUpdate = Date.now();

            /*             users = userData;
             */ foods = foodsList;
            viruses = virusList;
            fireFood = massList;
        }
    );

    // Death.
    socket.on("RIP", function () {
        global.gameStart = false;
        render.drawErrorMessage("You died!", graph, global.screen);
        window.setTimeout(() => {
            document.getElementById("gameAreaWrapper").style.opacity = 0;
            document.getElementById("startMenuWrapper").style.maxHeight =
                "1000px";
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on("kick", function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== "") {
            render.drawErrorMessage(
                "You were kicked for: " + reason,
                graph,
                global.screen
            );
        } else {
            render.drawErrorMessage("You were kicked!", graph, global.screen);
        }
        socket.close();
    });
}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2,
    };
};

window.requestAnimFrame = (function () {
    return (
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        }
    );
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame || window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
let lastFrameTime = Date.now();
let fpsCounter = 0;
let lastFpsUpdate = Date.now();
let currentFps = 0;

function gameLoop() {
    if (global.gameStart) {
        graph.fillStyle = global.backgroundColor;
        let now = Date.now();
        let deltaTime = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        // Lógica para contar los FPS
        fpsCounter++;
        if (now - lastFpsUpdate >= 1000) {
            currentFps = fpsCounter;
            fpsCounter = 0;
            lastFpsUpdate = now;
        }
        // Factor de interpolación o suavizado, ej 0.25
        const smoothFactor = 0.25;
        player.x = lerp(player.x, player.targetX, smoothFactor);
        player.y = lerp(player.y, player.targetY, smoothFactor);

        graph.fillRect(0, 0, global.screen.width, global.screen.height);

        render.drawGrid(global, player, global.screen, graph);
        foods.forEach((food) => {
            let position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });
        fireFood.forEach((fireFood) => {
            let position = getPosition(fireFood, player, global.screen);
            render.drawFireFood(position, fireFood, playerConfig, graph);
        });
        viruses.forEach((virus) => {
            let position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });

        let borders = {
            // Position of the borders on the screen
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y,
        };
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            let color = "hsl(" + users[i].hue + ", 100%, 50%)";
            let borderColor = "hsl(" + users[i].hue + ", 100%, 45%)";
            let user = users[i];

            for (var j = 0; j < user.cells.length; j++) {
                let cell = user.cells[j];
                cell.renderX = lerp(
                    cell.renderX ?? cell.x,
                    cell.x,
                    smoothFactor
                );
                cell.renderY = lerp(
                    cell.renderY ?? cell.y,
                    cell.y,
                    smoothFactor
                );
                cell.renderRadius = lerp(
                    cell.renderRadius ?? cell.radius,
                    cell.radius,
                    0.25
                );

                cellsToDraw.push({
                    color,
                    borderColor,
                    mass: cell.mass,
                    name: user.name,
                    radius: cell.renderRadius,
                    x: cell.renderX - player.x + global.screen.width / 2,
                    y: cell.renderY - player.y + global.screen.height / 2,
                });
            }
        }

        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(
            cellsToDraw,
            playerConfig,
            global.toggleMassState,
            borders,
            graph
        );

        socket.emit("0", window.canvas.target); // playerSendTarget "Heartbeat".
    }
}

window.addEventListener("resize", resize);

function resize() {
    if (!socket) return;

    player.screenWidth =
        c.width =
        global.screen.width =
            global.playerType == "player"
                ? window.innerWidth
                : global.game.width;
    player.screenHeight =
        c.height =
        global.screen.height =
            global.playerType == "player"
                ? window.innerHeight
                : global.game.height;

    if (global.playerType == "spectator") {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit("windowResized", {
        screenWidth: global.screen.width,
        screenHeight: global.screen.height,
    });
}
