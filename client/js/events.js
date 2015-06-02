let System = require('./system');

/**
 * @module Events
 * @description
 * A stateless module which handles all socket connections and
 * interface points for other modules to interact with the sockets.
 *
 * This module should not include any mutable state.
 */
let Events = {};

Events.socket = Events.setup(io());

Events.emit = {};

Events.emit.playerSendTarget = function(target) {
  Events.socket.emit('player-send-target', target);
};

Events.emit.ping = function() {
  System.status.lastPing = Date.now();
  Events.socket.emit('ping');
};

Events.emit.chat = function(message) {
  Events.socket.emit('player-chat', { message, player });
};

Events.setup = function(socket) {

  socket.on('pong', function() {
    let latency = Date.now() - System.status.lastPing;
  });

  socket.on('connect_failed', function() {
    socket.close();
    System.status.disconnected = true;
  });

  socket.on('disconnect', function() {
    socket.close();
    System.status.disconnected = true;
  });

  socket.on('welcome', function(settings) {
    System.status.started = true;

    player.name = settings.name;
    player.id = settings.id;
    player.hue = settings.hue;
    socket.emit('gotit', player);

    //console.log('Game is started: ' + gameStart);
    //addSystemLine('Connected to the game!');
  });

  socket.on('player_disconnect', function(data) {
    //enemies = data.playersList;
    //document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
    //addSystemLine('Player <b>' + data.disconnectName + '</b> disconnected!');
  });

  socket.on('player_join', function(data) {
    //enemies = data.playersList;
    //document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
    //addSystemLine('Player <b>' + data.connectedName + '</b> joined!');
  });

  socket.on('player_rip', function() {
    System.status.started = false;
    socket.close();
  });

  socket.on('server_send_player_chat', function(data) {
    // addChatLine(data.sender, data.message);
  });

  socket.on('server_tell_player_move', function() {
    //xoffset += (player.x - playerData.x);
    //yoffset += (player.y - playerData.y);
    //player = playerData;
    //foods = foodsList;
  });

  socket.on('server_tell_update_all', function() {
    //enemies = players;
    //foods = foodsList;
  });

  return socket;
};

export default Events;
