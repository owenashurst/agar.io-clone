"use strict";

const util = require('../lib/util');
const { v4: uuidv4 } = require('uuid');
const {getPosition} = require("../lib/entityUtils");

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
            const position = getPosition(this.foodUniformDisposition, radius, this.data)
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
