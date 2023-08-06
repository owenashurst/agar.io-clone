"use strict";

exports.foodUtils = require('./food');
exports.virusUtils = require('./virus');
exports.massFoodUtils = require('./massFood');

exports.Map = class {
    constructor(config) {
        this.food = new exports.foodUtils.FoodManager(config.foodMass, config.foodUniformDisposition);
        this.viruses = new exports.virusUtils.VirusManager(config.virus);
        this.massFood = new exports.massFoodUtils.MassFoodManager();
    }
}