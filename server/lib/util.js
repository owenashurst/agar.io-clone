/* jslint node: true */

'use strict';

var cfg = require('../config.json');

// determine mass from radius of circle
exports.massToRadius = function (mass) {
    return Math.sqrt(mass / Math.PI) * 10;
};


// overwrite Math.log function
exports.log = (function () {
    var log = Math.log;
    return function (n, base) {
        return log(n) / (base ? log(base) : 1);
    };
})();


// get the Euclidean distance between the edges of two shapes
exports.getDistance = function (p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - p1.radius - p2.radius;
};

function genPos(from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
}


// generate a random position within the field of play
exports.randomPosition = function (radius) {
    return {
        x: genPos(radius, cfg.gameWidth - radius),
        y: genPos(radius, cfg.gameHeight - radius)
    };
};
