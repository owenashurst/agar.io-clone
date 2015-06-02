let System = require('./system'),
    Player = require('./player'),
    Chat = require('./chat');

/**
 * @module Events
 * @description
 * A stateless module which handles all socket connections and
 * interface points for other modules to interact with the sockets.
 *
 * This module should not include any mutable state.
 */
let Events = {};

Events.socket = __setup__(io());

Events.emit = {};

Events.emit.sendTarget = function(target) {
  Events.socket.emit('player-send-target', target);
};

Events.emit.ping = function() {
  System.status.lastPing = Date.now();
  Events.socket.emit('ping');
};

Events.emit.chat = function(message) {
  Events.socket.emit('player-chat', { message, player: Player });
};

function __setup__(socket) {

  socket.on('pong', function() {
    console.log('Socket: pong');
    let latency = Date.now() - System.status.lastPing;
    Chat.addSystemLine(`Ping: ${latency} ms`);
  });

  socket.on('connect', function() {
    console.log('Socket: connected');
    System.status.connected = true;
  });

  socket.on('connect_failed', function() {
    console.log('Socket: failed');
    socket.close();
    System.status.connected = false;
  });

  socket.on('disconnect', function() {
    console.log('Socket: disconnect');
    socket.close();
    System.status.connected = false;
  });

  socket.on('welcome', function(settings) {
    console.log('Socket: welcome');
    System.status.started = true;

    Player.name = settings.name;
    Player.id = settings.id;
    Player.hue = settings.hue;
  });

  socket.on('player_disconnect', function(event) {
    console.log('Socket: player_disconnect');
    Game.entities.enemies = event.enemies;
    // render player count
    //document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
    Chat.addSystemLine(`Player ${event.disconnectName} disconnected!`);
  });

  socket.on('player_join', function(event) {
    console.log('Socket: player_join');
    Game.entities.enemies = event.enemies;
    // render player count
    //document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
    Chat.addSystemLine(`Player ${event.connectedName} connected!`);
  });

  socket.on('player_rip', function() {
    console.log('Socket: player_rip');
    System.status.started = false;
    socket.close();
  });

  socket.on('server_send_player_chat', function(event) {
    Chat.addChatLine(event.sender, event.message);
  });

  socket.on('server_tell_player_move', function(update, food) {
    Game.entities.food = food;

    Player.offset.x += (Player.x - update.x);
    Player.offset.y += (Player.y - update.y);
    Player.update(player);
  });

  socket.on('server_tell_update_all', function(enemies, food) {
    Game.entities.enemies = enemies;
    Game.entities.food = food;
  });

  return socket;
}

export default Events;
