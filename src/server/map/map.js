"use strict";

const util = require('../lib/util');

exports.foodUtils = require('./food');
exports.virusUtils = require('./virus');
exports.massFoodUtils = require('./massFood');
exports.playerUtils = require('./player');

exports.Map = class {
    constructor(config) {
        this.food = new exports.foodUtils.FoodManager(config.foodMass, config.foodUniformDisposition);
        this.viruses = new exports.virusUtils.VirusManager(config.virus);
        this.massFood = new exports.massFoodUtils.MassFoodManager();
        this.players = new exports.playerUtils.PlayerManager();
    }

    balanceMass(foodMass, gameMass, maxFood, maxVirus) {
        const totalMass = this.food.data.length * foodMass + this.players.getTotalMass();

        const massDiff = gameMass - totalMass;
        const maxFoodDiff = maxFood - this.food.data.length;
        const foodDiff = parseInt(massDiff / foodMass) - maxFoodDiff;
        const foodToAdd = Math.min(foodDiff, maxFoodDiff);
        const foodToRemove = -Math.max(foodDiff, maxFoodDiff);
        if (foodToAdd > 0) {
            console.debug('[DEBUG] Adding ' + foodToAdd + ' food');
            this.food.addNew(foodToAdd);
        }
        else if (foodToRemove > 0) {
            console.debug('[DEBUG] Removing ' + foodToRemove + ' food');
            this.food.removeExcess(foodToRemove);
        }

        //console.debug('[DEBUG] Mass rebalanced!');

        const virusesToAdd = maxVirus - this.viruses.data.length;
        if (virusesToAdd > 0) {
            this.viruses.addNew(virusesToAdd);
        }
    }

    enumerateWhatPlayersSee(callback) {
        for (let currentPlayer of this.players.data) {
            var visibleFood = this.food.data
                .filter(function (f) {
                    return util.testSquareRectangle(
                        f.x, f.y, 0,
                        currentPlayer.x, currentPlayer.y, currentPlayer.screenWidth / 2 + 20, currentPlayer.screenHeight / 2 + 20);
                });

            var visibleViruses = this.viruses.data
                .filter(function (f) {
                    return util.testSquareRectangle(
                        f.x, f.y, 0,
                        currentPlayer.x, currentPlayer.y, currentPlayer.screenWidth / 2 + exports.virusUtils.virusRadius, currentPlayer.screenHeight / 2 + exports.virusUtils.virusRadius);
                });

            var visibleMass = this.massFood.data
                .filter(function (f) {
                    return util.testSquareRectangle(
                        f.x, f.y, f.radius,
                        currentPlayer.x, currentPlayer.y, currentPlayer.screenWidth / 2 + 20, currentPlayer.screenHeight / 2 + 20);
                });


            const extractData = (player) => {
                return {
                    x: player.x,
                    y: player.y,
                    cells: player.cells,
                    massTotal: Math.round(player.massTotal),
                    hue: player.hue,
                    id: player.id,
                    name: player.name
                };
            }

            var visiblePlayers = [];
            for (let player of this.players.data) {
                for (let cell of player.cells) {
                    if (util.testSquareRectangle(
                        cell.x, cell.y, cell.radius,
                        player.x, player.y, player.screenWidth / 2 + 20, player.screenHeight / 2 + 20)) {
                        visiblePlayers.push(extractData(player));
                        break;
                    }
                }
            }

            callback(extractData(currentPlayer), visiblePlayers, visibleFood, visibleMass, visibleViruses);
        }
    }
}