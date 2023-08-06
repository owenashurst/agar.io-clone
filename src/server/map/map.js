"use strict";

exports.foodUtils = require('./food');

exports.Map = class {
    constructor(config) {
        this.food = new exports.foodUtils.FoodManager(config.foodMass, config.foodUniformDisposition);
    }
}