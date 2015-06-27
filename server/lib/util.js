/* jslint node: true */

'use strict';

var cfg = require('../config.json');

exports.validNick = function(nickname) {
    var regex = /^\w*$/;
    return regex.exec(nickname) !== null;
};

// determine mass from radius of circle
exports.massToRadius = function (mass) {
    return 10 + Math.sqrt(mass);
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

exports.uniformPosition = function(points, radius) {
    var bestCandidate, maxDistance = 0;
    var numberOfCandidates = 10;

    if (points.length === 0) {
        return exports.randomPosition(radius);
    }

    // Generate the cadidates
    for (var ci = 0; ci < numberOfCandidates; ci++) {
        var minDistance = Infinity;
        var candidate = exports.randomPosition(radius);
        candidate.radius = radius;

        for (var pi = 0; pi < points.length; pi++) {
            var distance = exports.getDistance(candidate, points[pi]);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        if (minDistance > maxDistance) {
            bestCandidate = candidate;
            maxDistance = minDistance;
        }
    }

    return bestCandidate;
};
