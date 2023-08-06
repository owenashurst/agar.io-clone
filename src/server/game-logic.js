const config = require('../../config');

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
    balanceMass
};