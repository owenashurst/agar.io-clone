"use strict";

const util = require('../lib/util');
const gameLogic = require('../game-logic');
const sat = require('sat')

exports.MassFood = class {

    constructor(playerFiring, cellIndex, mass) {
        this.id = playerFiring.id;
        this.num = cellIndex;
        this.mass = mass;
        this.hue = playerFiring.hue;
        this.direction = new sat.Vector(
            playerFiring.x - playerFiring.cells[cellIndex].x + playerFiring.target.x,
            playerFiring.y - playerFiring.cells[cellIndex].y + playerFiring.target.y
        ).normalize()
        this.x = playerFiring.cells[cellIndex].x;
        this.y = playerFiring.cells[cellIndex].y;
        this.radius = util.massToRadius(mass);
        this.speed = 25;
    }

    move(gameWidth, gameHeight) {
        var deltaX = this.speed * this.direction.x;
        var deltaY = this.speed * this.direction.y;

        this.speed -= 0.5;
        if (this.speed < 0) {
            this.speed = 0;
        }
        if (!isNaN(deltaY)) {
            this.y += deltaY;
        }
        if (!isNaN(deltaX)) {
            this.x += deltaX;
        }

        gameLogic.adjustForBoundaries(this, this.radius, 5, gameWidth, gameHeight);
    }
}

exports.MassFoodManager = class {
    constructor() {
        this.data = [];
    }

    addNew(playerFiring, cellIndex, mass)  {
        this.data.push(new exports.MassFood(playerFiring, cellIndex, mass));
    }

    move (gameWidth, gameHeight) {
        for (let currentFood of this.data) {
            if (currentFood.speed > 0) currentFood.move(gameWidth, gameHeight);
        }
    }

    remove(indexes) {
        if (indexes.length > 0) {
            this.data = util.removeIndexes(this.data, indexes);
        }
    }
}
