const util = require('./lib/util');

const movePlayer = (player) => {
    let x = 0;
    let y = 0;

    for (let i = 0; i < player.cells.length; i++)
    {
        const target = {
            x: player.x - player.cells[i].x + player.target.x,
            y: player.y - player.cells[i].y + player.target.y
        };

        const distance = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
        const degrees = Math.atan2(target.y, target.x);

        let slowDown = 1;

        if(player.cells[i].speed <= 6.25) {
            slowDown = util.mathLog(player.cells[i].mass, config.slowBase) - initMassLog + 1;
        }

        let deltaY = player.cells[i].speed * Math.sin(degrees) / slowDown;
        let deltaX = player.cells[i].speed * Math.cos(degrees) / slowDown;

        if(player.cells[i].speed > 6.25) {
            player.cells[i].speed -= 0.5;
        }
        if (distance < (50 + player.cells[i].radius)) {
            deltaY *= distance / (50 + player.cells[i].radius);
            deltaX *= distance / (50 + player.cells[i].radius);
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
                const newDistance = Math.sqrt(Math.pow(player.cells[j].y-player.cells[i].y,2) + Math.pow(player.cells[j].x-player.cells[i].x,2));
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
                    else if(newDistance < radiusTotal / 1.75) {
                        player.cells[i].mass += player.cells[j].mass;
                        player.cells[i].radius = util.massToRadius(player.cells[i].mass);
                        player.cells.splice(j, 1);
                    }
                }
            }
        }

        if (player.cells.length > i) {
            var borderCalc = player.cells[i].radius / 3;
            if (player.cells[i].x > config.gameWidth - borderCalc) {
                player.cells[i].x = config.gameWidth - borderCalc;
            }
            if (player.cells[i].y > config.gameHeight - borderCalc) {
                player.cells[i].y = config.gameHeight - borderCalc;
            }
            if (player.cells[i].x < borderCalc) {
                player.cells[i].x = borderCalc;
            }
            if (player.cells[i].y < borderCalc) {
                player.cells[i].y = borderCalc;
            }
            x += player.cells[i].x;
            y += player.cells[i].y;
        }
    }

    player.x = x/player.cells.length;
    player.y = y/player.cells.length;
};

const moveMass = (mass) => {
    const degrees = Math.atan2(mass.target.y, mass.target.x);
    const deltaY = mass.speed * Math.sin(degrees);
    const deltaX = mass.speed * Math.cos(degrees);

    mass.speed -= 0.5;
    if(mass.speed < 0) {
        mass.speed = 0;
    }
    if (!isNaN(deltaY)) {
        mass.y += deltaY;
    }
    if (!isNaN(deltaX)) {
        mass.x += deltaX;
    }

    const borderCalc = mass.radius + 5;

    if (mass.x > config.gameWidth - borderCalc) {
        mass.x = config.gameWidth - borderCalc;
    }
    if (mass.y > config.gameHeight - borderCalc) {
        mass.y = config.gameHeight - borderCalc;
    }
    if (mass.x < borderCalc) {
        mass.x = borderCalc;
    }
    if (mass.y < borderCalc) {
        mass.y = borderCalc;
    }
};