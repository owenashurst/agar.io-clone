var target_food;

module.exports = {
    name: 'ExampleRobot',

    step: function(userData, foodsList, massList, virusList) {
        var target_position = {x: 0, y:0};
        var closest_food;

        // get biggest cell
        var biggest_cell = get_my_biggest_cell(userData);

        // get a new target food if we don't have a target or it was eaten already
        if (!target_food || was_eaten(target_food, foodsList)) {
            target_food = get_closest_food(biggest_cell, foodsList);
        }

        console.log('target', target_food);

        if (!target_food) {
            // if no food is found move to the right corner, hope or cry
            target_position.x = 25;
            target_position.y = 25;
            return target_position;
        } else {
            // go and get it, tiger!
            // vSourceToDestination = vDestination - vSource;
            // multuplication makes sure we are going as fast as possible
            target_position.x = (target_food.x - biggest_cell.x) * 25;
            target_position.y = (target_food.y - biggest_cell.y) * 25;
            return target_position;
        }
    },

};

function was_eaten(food, foodsList) {
    var exist = foodsList.filter(function(e) {
        return food.id === e.id;
    });

    return !exist;
}

function get_closest_food(origin, foodsList) {

    if (!foodsList) {
        return null;
    }

    // get the distance to all food cells
    var food_distances = foodsList.map(function(food, idx) {
        return {'food': food, 'distance': calc_distance(origin, food)};
    });

    // sort descending
    food_distances.sort(function(a, b) { return b.distance - a.distance; });
    closest = food_distances[0].food;
    closest.distance = food_distances[0].distance;
    return food_distances[0].food;
}

function get_my_biggest_cell(userData) {
    // sort descending
    userData.sort(function(a, b) { return b.mass - a.mass; });
    return userData[0];
}

function calc_distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}
