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
    Chat.addSystemLine(`Ping: ${latency} ms`);
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

    Chat.addSystemLine('Connected to the game!');
  });

  socket.on('player_disconnect', function(event) {
    Game.entities.enemies = event.enemies;
    // render player count
    //document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
    Chat.addSystemLine(`Player ${event.disconnectName} disconnected!`);
  });

  socket.on('player_join', function(event) {
    Game.entities.enemies = event.enemies;
    // render player count
    //document.getElementById('status').innerHTML = 'Players: ' + enemies.length;
    Chat.addSystemLine(`Player ${event.connectedName} connected!`);
  });

  socket.on('player_rip', function() {
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
};

export default Events;
