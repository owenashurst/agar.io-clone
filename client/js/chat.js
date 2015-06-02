import Events from './events';
import Player from './player';

/**
 * @module Chat
 * @description
 * This module ties the events system to the DOM for the chat
 * interface. All chat related stuff lives in here.
 */
let Chat = {};

Chat.DOM = {};
Chat.commands = {};

/**
 * @name Chat.registerCommand
 * @param {string} command
 * @param {string} description
 * @param {function} callback
 * @description
 * Registers a command with a description and a callback which will
 * be called every time the users enters that command.
 */
Chat.registerCommand = function(command, description, callback) {
  Chat.commands[command] = { description, callback };
};

/**
 * @name Chat.bindToElement
 * @description
 * Gets the DOM elements for the chat. Don't call before the DOM
 * is loaded.
 */
Chat.bindElements = function() {
  Chat.DOM.input = document.getElementById('chatInput');
  Chat.DOM.list = document.getElementById('chatList');

  Chat.DOM.input.addEventListener('keydown', function(event) {
    let key = event.which || event.keyCode;
    if(key === 13) {
      Chat.send();
    }
  });
};

/**
 * @name Chat.send
 * @description
 * Try to send whatever message is inside the text input for chat.
 */
Chat.send = function() {
  let text = Chat.DOM.input.value.replace(/(<([^>]+)>)/ig, '');
  if(text.length === 0) return;

  if(text.indexOf('-') === 0) {
    let args = text.slice(1).split(' '),
        name = args.shift();

    if(Chat.commands[name]) {
      Chat.commands[name].callback.apply(null, args);
    } else {
      Chat.addSystemLine(`Unrecognised Command: ${name}, type -help for more info`);
    }
  } else {
    Events.default.emit.chat({
      sender: Player.name,
      message: text
    });

    Chat.addChatLine(Player.name, text);
  }

  Chat.DOM.input.value = '';
};

/**
 * @name Chat.refreshList
 * @description
 * Remove some chat messages if there are too many there already.
 */
Chat.refreshList = function() {
  if(Chat.DOM.list.childNodes.length >= 5) {
    let firstMessage = Chat.DOM.list.childNodes[0];
    Chat.DOM.list.removeChild(firstMessage);
  }
};

/**
 * @name Chat.addChatLine
 * @param {string} name
 * @param {string} text
 * @description
 * Adds a new message to the chat, given a player's name and a
 * message.
 */
Chat.addChatLine = function(name, text) {
  let li = document.createElement('li'),
      b = document.createElement('b'),
      user = document.createTextNode(name),
      message = document.createTextNode(text);

  li.className = (name === Player.name) ? 'me' : 'friend';
  b.appendChild(user);
  li.appendChild(b);
  li.appendChild(message);

  Chat.refreshList();
  Chat.DOM.list.appendChild(li);
};

/**
 * @name Chat.addSystemLine
 * @param {string} text
 * @description
 * Adds a message to the chat which is styled to show that it comes
 * from the system, not a player.
 */
Chat.addSystemLine = function(text) {
  let li = document.createElement('li'),
      message = document.createTextNode(text);

  li.className = 'system';
  li.appendChild(message);

  Chat.refreshList();

  Chat.DOM.list.appendChild(li);
};

/**
 * @name Chat.printHelp
 * @description
 * Prints out help for each of the registered commands.
 */
Chat.printHelp = function() {
  Object.keys(Chat.commands).forEach(function(commandName) {
    let command = Chat.commands[commandName];
    if(Chat.commands.hasOwnProperty(command)) {
      Chat.addSystemLine(`-${commandName}: ${command.description}`);
    }
  });
};

export default Chat;

