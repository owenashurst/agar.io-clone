const config = require('../../config');
const adjustForBoundaries = (position, radius, borderOffset, gameWidth, gameHeight) => {
    const borderCalc = radius + borderOffset;
    if (position.x > gameWidth - borderCalc) {
        position.x = gameWidth - borderCalc;
    }
    if (position.y > gameHeight - borderCalc) {
        position.y = gameHeight - borderCalc;
    }
    if (position.x < borderCalc) {
        position.x = borderCalc;
    }
    if (position.y < borderCalc) {
        position.y = borderCalc;
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

    const virusesToAdd = config.maxVirus - viruses.data.length;
    if (virusesToAdd > 0) {
        viruses.addNew(virusesToAdd);
    }
};

module.exports = {
    adjustForBoundaries,
    balanceMass
};