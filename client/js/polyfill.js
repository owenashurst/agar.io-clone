/**
 * @module Polyfill
 * @description
 * All polyfills should live in here.
 */
let Polyfill = window;

Polyfill.requestAnimationFrame =
  window.requestAnimationFrame       ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame    ||
  function(callback) {
      window.setTimeout(callback, 1000 / 60);
  };

export default Polyfill;
