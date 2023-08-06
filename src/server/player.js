const config = require('../../config');
const util = require('./lib/util');
const gameLogic = require('./game-logic');

const initMassLog = util.mathLog(config.defaultPlayerMass, config.slowBase);

const MIN_SPEED = 6.25;
const SPEED_DECREMENT = 0.5;
const MIN_DISTANCE = 50;
const MERGE_DISTANCE_RATIO = 1.75;
const BORDER_OFFSET = 5;

const calculateMovement = (target, speed, slowDown = 1) => {
    const degrees = Math.atan2(target.y, target.x);
    const deltaY = speed * Math.sin(degrees) / slowDown;
    const deltaX = speed * Math.cos(degrees) / slowDown;
    return { deltaX, deltaY };
};

const calculateDistance = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
};

const movePlayer = (player) => {
    let x = 0;
    let y = 0;

    for (let i = 0; i < player.cells.length; i++) {
        const target = {
            x: player.x - player.cells[i].x + player.target.x,
            y: player.y - player.cells[i].y + player.target.y
        };

        const distance = calculateDistance(0, 0, target.x, target.y);

        let slowDown = 1;
        if(player.cells[i].speed <= MIN_SPEED) {
            slowDown = util.mathLog(player.cells[i].mass, config.slowBase) - initMassLog + 1;
        }

        let { deltaX, deltaY } = calculateMovement(target, player.cells[i].speed, slowDown);

        if(player.cells[i].speed > MIN_SPEED) {
            player.cells[i].speed -= SPEED_DECREMENT;
        }
        if (distance < (MIN_DISTANCE + player.cells[i].radius)) {
            deltaY *= distance / (MIN_DISTANCE + player.cells[i].radius);
            deltaX *= distance / (MIN_DISTANCE + player.cells[i].radius);
        }
        if (!isNaN(deltaY)) {
            player.cells[i].y += deltaY;
        }
        if (!isNaN(deltaX)) {
            player.cells[i].x += deltaX;
        }

        // Find best solution.
        for (let j = 0; j < player.cells.length; j++) {
            if (j != i && player.cells[i] !== undefined) {
                const newDistance = calculateDistance(player.cells[i].x, player.cells[i].y, player.cells[j].x, player.cells[j].y);
                const radiusTotal = (player.cells[i].radius + player.cells[j].radius);

                if (newDistance < radiusTotal) {
                    if(player.lastSplit > new Date().getTime() - 1000 * config.mergeTimer) {
                        if(player.cells[i].x < player.cells[j].x) {
                            player.cells[i].x--;
                        } else if(player.cells[i].x > player.cells[j].x) {
                            player.cells[i].x++;
                        }
                        if(player.cells[i].y < player.cells[j].y) {
                            player.cells[i].y--;
                        } else if((player.cells[i].y > player.cells[j].y)) {
                            player.cells[i].y++;
                        }
                    }
                    else if(newDistance < radiusTotal / MERGE_DISTANCE_RATIO) {
                        player.cells[i].mass += player.cells[j].mass;
                        player.cells[i].radius = util.massToRadius(player.cells[i].mass);
                        player.cells.splice(j, 1);
                    }
                }
            }
        }

        if (player.cells.length > i) {
            gameLogic.adjustForBoundaries(player.cells[i], player.cells[i].radius / 3, 0, config.gameWidth, config.gameHeight);
            x += player.cells[i].x;
            y += player.cells[i].y;
        }
    }

    player.x = x/player.cells.length;
    player.y = y/player.cells.length;
};

const moveMass = (mass) => {
    const { deltaX, deltaY } = calculateMovement(mass.target, mass.speed);

    mass.speed -= SPEED_DECREMENT;
    if(mass.speed < 0) {
        mass.speed = 0;
    }
    if (!isNaN(deltaY)) {
        mass.y += deltaY;
    }
    if (!isNaN(deltaX)) {
        mass.x += deltaX;
    }

    gameLogic.adjustForBoundaries(mass, mass.radius, BORDER_OFFSET, config.gameWidth, config.gameHeight);
};

module.exports = {
    movePlayer,
    moveMass,
};