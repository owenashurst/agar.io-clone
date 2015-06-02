let Chat = require('./chat');

let System = {};

System.status = {
  started: false,
  connected: false,
  lastPing: 0,
  darkMode: false
};

System.toggleDarkMode = function() {
  System.status.darkMode = !System.status.darkMode;
  // update in DOM
  Chat.addSystemLine('Dark mode' + System.status.darkMode ? 'enabled' : 'disabled');
};

export default System;

