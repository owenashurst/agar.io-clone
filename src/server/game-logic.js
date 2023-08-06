const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const util = require('./lib/util');

const addVirus = (toAdd, viruses) => {
    while (toAdd--) {
        const mass = util.randomInRange(config.virus.defaultMass.from, config.virus.defaultMass.to, true);
        const radius = util.massToRadius(mass);
        const position = config.virusUniformDisposition ? util.uniformPosition(viruses, radius) : util.randomPosition(radius);

        viruses.push({
            id: uuidv4(),
            x: position.x,
            y: position.y,
            radius: radius,
            mass: mass,
            fill: config.virus.fill,
            stroke: config.virus.stroke,
            strokeWidth: config.virus.strokeWidth
        });
    }
};

const balanceMass = (food, viruses, users) => {
    const totalMass = food.data.length * config.foodMass +
        users
            .map((u) =>  u.massTotal)
            .reduce((pu,cu) => { 
                return pu + cu; 
            }, 0);

    const massDiff = config.gameMass - totalMass;
    const maxFoodDiff = config.maxFood - food.data.length;
    const foodDiff = parseInt(massDiff / config.foodMass) - maxFoodDiff;
    const foodToAdd = Math.min(foodDiff, maxFoodDiff);
    const foodToRemove = -Math.max(foodDiff, maxFoodDiff);

    if (foodToAdd > 0) {
        console.debug('[DEBUG] Adding ' + foodToAdd + ' food');
        food.addNew(foodToAdd);
    }
    else if (foodToRemove > 0) {
        console.debug('[DEBUG] Removing ' + foodToRemove + ' food');
        food.removeExcess(foodToRemove);
    }

    //console.debug('[DEBUG] Mass rebalanced!');

    const virusesToAdd = config.maxVirus - viruses.length;
    if (virusesToAdd > 0) {
        addVirus(virusesToAdd, viruses);
    }
};

module.exports = {
    addVirus,
    balanceMass
};