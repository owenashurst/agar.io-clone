var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var users = [];
var foods = [];
var sockets = [];

app.get('/', function(req, res){
  res.sendfile('index.html');
});

function genPos(from, to) {
	return Math.floor(Math.random() * to) + from;
}

function addFoods() {
	var rx = genPos(0, 2000);
	var ry = genPos(0, 1000);
	var food = {
		foodID: (new Date()).getTime(),
		x: rx, y: ry,
		ate: false
	};
	foods[foods.length] = food;
}

setInterval(function(){
	if (foods.length < 200) {
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


io.on('connection', function(socket){  
  console.log('A user connected. Assigning UserID...');

  var userID = socket.id;

  socket.emit("welcome", userID);

  socket.on("gotit", function(player){
  	console.log("User #" + userID + " accepted!");
  	player.playerID = userID;
  	sockets[player.playerID] = socket;
  	if (findPlayer(player.playerID) == null) {
  		console.log("Add player");
      users.push(player);
  	}

  	console.log("Total player: " + users.length);

  	socket.emit("playerJoin", users);
  });

  socket.on("playerKill", function(player, victim){
  	console.log("KILLING");
  	users[findPlayerIndex(player.playerID)] = player;
  	sockets[victim.playerID].emit("DIE");
  	socket.emit("playerUpdate", users);
  });

  socket.on("playerEat", function(player, food){
  	users[findPlayerIndex(player.playerID)] = player;
    foods.splice(findFoodIndex(food.foodID), 1);

  	socket.emit("playerUpdate", users);
  	socket.emit("foodUpdate", foods);
  });

  socket.on("playerSendPos", function(player){
  	users[findPlayerIndex(player.playerID)] = player;
  	socket.emit("playerUpdate", users);
  	socket.emit("foodUpdate", foods);
  });

  socket.on('disconnect', function(){
  	users.splice(findPlayerIndex(userID), 1);
  	console.log('User #' + userID + ' disconnected');
  	socket.emit("playerDisconnect", users);
  });

});

http.listen(3000, function(){
  console.log('listening on *:3000');
});