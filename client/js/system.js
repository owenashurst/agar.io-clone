import Chat from './chat';
import Config from './config.json';

/**
 * @module System
 * @description
 * A stateful module which exposes system specific properties
 * and methods.
 */
let System = {};

System.status = {
  started: false,
  connected: false,
  lastPing: 0,
  background: Config.background.light
};

System.toggleDarkMode = function() {
  if(System.status.background === Config.background.light) {
    System.status.background = Config.background.dark;
    Chat.addSystemLine('Dark mode enabled');
  } else {
    System.status.background = Config.background.dark;
    Chat.addSystemLine('Dark mode enabled');
  }
};

export default System;

