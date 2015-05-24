/**
 * Created by chris on 24/05/15.
 */

var playerName = prompt("Your name please:").replace(/(<([^>]+)>)/ig,"");

// Canvas
var gameWidth = window.innerWidth;
var gameHeight = window.innerHeight;

var socket = io();
var gameStart = false;
var disconnected = false;

var startPingTime = 0;

var KEY_ENTER = 13;

var foodConfig = {
  border: 2,
  borderColor: "#f39c12",
  fillColor: "#f1c40f",
  size: 5
};

var playerConfig = {
  border: 3,
  borderColor: "#c0392b",
  fillColor: "#ea6153",
  textColor: "#FFFFFF",
  textBorder: "#000000",
  textBorderSize: 3,
  defaultSize: 10
};

var enemyConfig = {
  border: 3,
  borderColor: "#27ae60",
  fillColor: "#2ecc71",
  textColor: "#FFFFFF",
  textBorder: "#000000",
  textBorderSize: 3,
  defaultSize: 10
};

var player = {
  playerID: -1,
  x: gameWidth / 2, y: gameHeight / 2,
  mass: 0, speed: 80,
  screenWidth: gameWidth,
  screenHeight: gameHeight
};

var foods = [];
var enemies = [];
var target = {x: player.x, y: player.y};

var c = document.getElementById("cvs");
c.addEventListener("mousemove", gameInput, false);
c.width = gameWidth; c.height = gameHeight;

var graph = c.getContext("2d");

var chatInput = document.getElementById("chatInput");
chatInput.addEventListener("keypress", sendChat);

// Chat
function addChatLine(name, text) {
  var chatLine = document.createElement("li");
  chatLine.className = (name == player.name)?"me":"friend";
  chatLine.innerHTML = "<b>" + name + "</b>: " + text;
  var chatList = document.getElementById("chatList");
  chatList.insertBefore(chatLine, chatList.childNodes[0]);
}

function addSystemLine(text) {
  var chatLine = document.createElement("li");
  chatLine.className = "system";
  chatLine.innerHTML = text;
  var chatList = document.getElementById("chatList");
  chatList.insertBefore(chatLine, chatList.childNodes[0]);
}

function checkLatency() {
  // Ping
  startPingTime = Date.now();
  socket.emit("ping");
}

function sendChat(key) {
  var key = key.which || key.keyCode;
  if (key == KEY_ENTER) {
    var text = chatInput.value.replace(/(<([^>]+)>)/ig,"");
    if (text != "") {
      if (text != "-ping") {
        socket.emit("playerChat", { sender: player.name, message: text });
        addChatLine(player.name, text);
      } else {
        checkLatency();
      }
      chatInput.value = "";
    }
  }
}

// Handle ping
socket.on("pong", function(){
  var latency = Date.now() - startPingTime;
  console.log("Latency: " + latency + "ms");
  addSystemLine("Ping: " + latency + "ms");
});

// Handle error
socket.on("connect_failed", function() {
  socket.close();
  disconnected = true;
});

socket.on("disconnect", function() {
  socket.close();
  disconnected = true;
});

// Handle connection
socket.on("welcome", function(userID) {
  player.playerID = userID;
  player.name = playerName;
  socket.emit("gotit", player);
  gameStart = true;
  console.log("Game is started: " + gameStart);
  addSystemLine("Connected to the game!");
});

socket.on("playerDisconnect", function(data) {
  enemies = data.playersList;
  document.getElementById("status").innerHTML = "Players: " + enemies.length;
  addSystemLine("Player <b>" + data.disconnectName + "</b> disconnected!");
});

socket.on("playerJoin", function(data) {
  console.log(data);
  enemies = data.playersList;
  document.getElementById("status").innerHTML = "Players: " + enemies.length;
  addSystemLine("Player <b>" + data.connectedName + "</b> joined!");
});

// Chat
socket.on("serverSendPlayerChat", function(data){
  addChatLine(data.sender, data.message);
});

// Handle movement
socket.on("serverTellPlayerMove", function(playerData) {
  player = playerData;
});

socket.on("serverUpdateAllPlayers", function(players) {
  enemies = players;
});


// Update others
socket.on("serverTellPlayerUpdateFoods", function(foodsList) {
  foods = foodsList;
});

socket.on("serverUpdateAllFoods", function(foodsList) {
  foods = foodsList;
});


// Die
socket.on("RIP", function(){
  gameStart = false;
  socket.close();
});


function drawFood(food) {
  graph.strokeStyle = foodConfig.borderColor;
  graph.fillStyle = foodConfig.fillColor;
  graph.lineWidth = foodConfig.border;
  graph.beginPath();
  graph.arc(food.x, food.y, foodConfig.size, 0, 2 * Math.PI);
  graph.stroke();
  graph.fill();
}

function drawPlayer() {
  graph.strokeStyle = playerConfig.borderColor;
  graph.fillStyle = playerConfig.fillColor;
  graph.lineWidth = playerConfig.border;
  graph.beginPath();
  graph.arc(player.x, player.y, playerConfig.defaultSize + player.mass, 0, 2 * Math.PI);
  graph.stroke();
  graph.fill();

  var fontSize = (player.mass / 2) + playerConfig.defaultSize;
  graph.lineWidth = playerConfig.textBorderSize;
  graph.textAlign = "center";
  graph.fillStyle = playerConfig.textColor;
  graph.textBaseline = 'middle';
  graph.strokeStyle = playerConfig.textBorder;
  graph.font = "bold " + fontSize + "px sans-serif";
  graph.strokeText(player.name, player.x, player.y);
  graph.fillText(player.name, player.x, player.y);
}

function drawEnemy(enemy) {
  graph.strokeStyle = enemyConfig.borderColor;
  graph.fillStyle = enemyConfig.fillColor;
  graph.lineWidth = enemyConfig.border;
  graph.beginPath();
  graph.arc(enemy.x, enemy.y, enemyConfig.defaultSize + enemy.mass, 0, 2 * Math.PI);
  graph.fill();
  graph.stroke();

  var fontSize = (enemy.mass / 2) + enemyConfig.defaultSize;

  graph.lineWidth = enemyConfig.textBorderSize;
  graph.textAlign = "center";
  graph.fillStyle = enemyConfig.textColor;
  graph.textBaseline = 'middle';
  graph.strokeStyle = enemyConfig.textBorder;
  graph.font = "bold " + fontSize + "px sans-serif";
  graph.strokeText(enemy.name, enemy.x, enemy.y);
  graph.fillText(enemy.name, enemy.x, enemy.y);
}

function gameInput(mouse) {
  target.x = mouse.clientX;
  target.y = mouse.clientY;
}

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
    function( callback ){
      window.setTimeout(callback, 1000 / 60);
    };
})();

(function animloop(){
  requestAnimFrame(animloop);
  gameLoop();
})();

function gameLoop() {
  if (!disconnected) {
    if (gameStart) {
      graph.fillStyle = "#EEEEEE";
      graph.fillRect(0, 0, gameWidth, gameHeight);

      for (var i = 0; i < foods.length; i++) {
        drawFood(foods[i]);
      }

      for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].playerID != player.playerID) {
          drawEnemy(enemies[i]);
        }
      }

      drawPlayer();
      socket.emit("playerSendTarget", target);
    } else {
      graph.fillStyle = "#333333";
      graph.fillRect(0, 0, gameWidth, gameHeight);

      graph.textAlign = "center";
      graph.fillStyle = "#FFFFFF";
      graph.font = "bold 30px sans-serif";
      graph.fillText("Game Over!", gameWidth / 2, gameHeight / 2);
    }
  } else {
    graph.fillStyle = "#333333";
    graph.fillRect(0, 0, gameWidth, gameHeight);

    graph.textAlign = "center";
    graph.fillStyle = "#FFFFFF";
    graph.font = "bold 30px sans-serif";
    graph.fillText("Disconnected!", gameWidth / 2, gameHeight / 2);
  }
}