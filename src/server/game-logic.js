const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const util = require('./lib/util');

const initMassLog = util.mathLog(config.defaultPlayerMass, config.slowBase);

const addFood = (toAdd, food) => {
    var radius = util.massToRadius(config.foodMass);

    while (toAdd--) {
        const position = config.foodUniformDisposition ? util.uniformPosition(food, radius) : util.randomPosition(radius);
        food.push({
            // Make IDs unique.
            id: uuidv4(),
            x: position.x,
            y: position.y,
            radius: radius,
            mass: Math.random() + 2,
            hue: Math.round(Math.random() * 360)
        });
    }
};

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

const removeFood = (toRem) => {
    while (toRem--) {
        food.pop();
    }
};

const balanceMass = (food, viruses, users) => {
    const totalMass = food.length * config.foodMass +
        users
            .map((u) =>  u.massTotal)
            .reduce((pu,cu) => { 
                return pu + cu; 
            }, 0);

    const massDiff = config.gameMass - totalMass;
    const maxFoodDiff = config.maxFood - food.length;
    const foodDiff = parseInt(massDiff / config.foodMass) - maxFoodDiff;
    const foodToAdd = Math.min(foodDiff, maxFoodDiff);
    const foodToRemove = -Math.max(foodDiff, maxFoodDiff);

    if (foodToAdd > 0) {
        console.debug('[DEBUG] Adding ' + foodToAdd + ' food');
        addFood(foodToAdd, food);
    }
    else if (foodToRemove > 0) {
        console.debug('[DEBUG] Removing ' + foodToRemove + ' food');
        removeFood(foodToRemove, viruses);
    }

    //console.debug('[DEBUG] Mass rebalanced!');

    const virusesToAdd = config.maxVirus - viruses.length;
    if (virusesToAdd > 0) {
        addVirus(virusesToAdd, viruses);
    }
};

module.exports = {
    addFood,
    removeFood,
    addVirus,
    movePlayer,
    moveMass,
    balanceMass
};