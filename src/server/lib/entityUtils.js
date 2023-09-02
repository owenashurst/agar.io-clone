const util = require("./util");

function getPosition(isUniform, radius, uniformPositions) {
    return isUniform ? util.uniformPosition(uniformPositions, radius) : util.randomPosition(radius);
}

exports.getPosition = getPosition;
