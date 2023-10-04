"use strict";

const util = require('../lib/util');
const { v4: uuidv4 } = require('uuid');
const {getPosition} = require("../lib/entityUtils");

class Virus {
    constructor(position, radius, mass, config) {
        this.id = uuidv4();
        this.x = position.x;
        this.y = position.y;
        this.radius = radius;
        this.mass = mass;
        this.fill = config.fill;
        this.stroke = config.stroke;
        this.strokeWidth = config.strokeWidth;
    }
}

exports.VirusManager = class {
    constructor(virusConfig) {
        this.data = [];
        this.virusConfig = virusConfig;
    }

    pushNew(virus) {
        this.data.push(virus);
    }

    addNew(number) {
        while (number--) {
            var mass = util.randomInRange(this.virusConfig.defaultMass.from, this.virusConfig.defaultMass.to);
            var radius = util.massToRadius(mass);
            var position = getPosition(this.virusConfig.uniformDisposition, radius, this.data);
            var newVirus = new Virus(position, radius, mass, this.virusConfig);
            this.pushNew(newVirus);
        }
    }

    delete(virusCollision) {
        this.data.splice(virusCollision, 1);
    }
};
