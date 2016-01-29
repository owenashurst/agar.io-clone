const Config = require('../../config.json');

exports.validNick = (nickname) => {
  const regex = /^\w*$/;
  return regex.exec(nickname) !== null;
};

// determine mass from radius of circle
exports.massToRadius = (mass) => {
  return 4 + Math.sqrt(mass) * 6;
};


// overwrite Math.log function
exports.log = (() => {
  const log = Math.log;
  return (n, base) => {
    return log(n) / (base ? log(base) : 1);
  };
})();

// get the Euclidean distance between the edges of two shapes
exports.getDistance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - p1.radius - p2.radius;
};

exports.randomInRange = (from, to) => {
  return Math.floor(Math.random() * (to - from)) + from;
};

// generate a random position within the field of play
exports.randomPosition = (radius) => {
  return {
    x: exports.randomInRange(radius, Config.gameWidth - radius),
    y: exports.randomInRange(radius, Config.gameHeight - radius)
  };
};

exports.uniformPosition = (points, radius) => {
  let bestCandidate;
  let maxDistance = 0;
  const numberOfCandidates = 10;

  if (points.length === 0) {
    return exports.randomPosition(radius);
  }

  // Generate the cadidates
  for (let ci = 0; ci < numberOfCandidates; ci++) {
    let minDistance = Infinity;
    const candidate = exports.randomPosition(radius);
    candidate.radius = radius;

    for (let pi = 0; pi < points.length; pi++) {
      const distance = exports.getDistance(candidate, points[pi]);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    if (minDistance > maxDistance) {
      bestCandidate = candidate;
      maxDistance = minDistance;
    } else {
      return exports.randomPosition(radius);
    }
  }

  return bestCandidate;
};

exports.findIndex = (arr, id) => {
  let len = arr.length;

  while (len--) {
    if (arr[len].id === id) {
      return len;
    }
  }

  return -1;
};

exports.randomColor = () => {
  const color = `#${('00000' + (Math.random() * (1 << 24) | 0).toString(16)).slice(-6)}`;
  const c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  const r = (parseInt(c[1], 16) - 32) > 0 ? (parseInt(c[1], 16) - 32) : 0;
  const g = (parseInt(c[2], 16) - 32) > 0 ? (parseInt(c[2], 16) - 32) : 0;
  const b = (parseInt(c[3], 16) - 32) > 0 ? (parseInt(c[3], 16) - 32) : 0;

  return {
    fill: color,
    border: `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  };
};
