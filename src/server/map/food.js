"use strict";

const util = require('../lib/util');
const { v4: uuidv4 } = require('uuid');

class Food {
    constructor(position, radius) {
        this.id = uuidv4();
        this.x = position.x;
        this.y = position.y;
        this.radius = radius;
        this.mass = Math.random() + 2;
        this.hue = Math.round(Math.random() * 360);
    }
}

exports.FoodManager = class {
    constructor(foodMass, foodUniformDisposition) {
        this.data = [];
        this.foodMass = foodMass;
        this.foodUniformDisposition = foodUniformDisposition;
    }

    addNew(number) {
        const radius = util.massToRadius(this.foodMass);
        while (number--) {
            const position = this.foodUniformDisposition
                ? util.uniformPosition(this.data, radius)
                : util.randomPosition(radius);
            this.data.push(new Food(position, radius));
        }
    }

    removeExcess(number) {
        while (number-- && this.data.length) {
            this.data.pop();
        }
    }

    delete(foodsToDelete) {
        if (foodsToDelete.length > 0) {
            this.data = util.removeIndexes(this.data, foodsToDelete);
        }
    }
};
