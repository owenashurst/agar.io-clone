const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, 2 * Math.PI);
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawFood = (position, food, graph) => {
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.lineWidth = 0;
    drawRoundObject(position, food.radius, graph);
};

const drawVirus = (position, virus, graph) => {
    graph.strokeStyle = virus.stroke;
    graph.fillStyle = virus.fill;
    graph.lineWidth = virus.strokeWidth;
    var theta = 0;
    var sides = 20;
    var x = 0;
    var y = 0;

    graph.beginPath();
    for (var i = 0; i < sides; i++) {
        theta = (i / sides) * 2 * Math.PI;
        x = position.x + virus.radius * Math.sin(theta);
        y = position.y + virus.radius * Math.cos(theta);
        graph.lineTo(x, y);
    }
    graph.closePath();
    graph.stroke();
    graph.fill();
};

const drawFireFood = (position, mass, playerConfig, graph) => {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border + 2;
    drawRoundObject(position, mass.radius - 1, graph);
};

const drawCells = (cells, playerConfig, toggleMassState, graph) => {
    for (let cell of cells) {
        graph.lineWidth = 6;
        graph.fillStyle = cell.color;
        graph.strokeStyle = cell.borderColor;

        drawRoundObject(cell, cell.radius, graph);

        var fontSize = Math.max(cell.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';
        graph.strokeText(cell.name, cell.x, cell.y);
        graph.fillText(cell.name, cell.x, cell.y);
        if (toggleMassState === 1) {
            graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            if (cell.name.length === 0) fontSize = 0;
            graph.strokeText(Math.round(cell.mass), cell.x, cell.y + fontSize);
            graph.fillText(Math.round(cell.mass), cell.x, cell.y + fontSize);
        }
    }
};

const drawGrid = (global, player, screen, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = global.lineColor;
    graph.globalAlpha = 0.15;
    graph.beginPath();

    for (var x = -player.x; x < screen.width; x += screen.height / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screen.height);
    }

    for (var y = -player.y; y < screen.height; y += screen.height / 18) {
        graph.moveTo(0, y);
        graph.lineTo(screen.width, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
};

const drawBorder = (game, lineColor, player, playerConfig, screen, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = playerConfig.borderColor;

    // Left-vertical.
    if (player.x <= screen.width / 2) {
        graph.beginPath();
        graph.moveTo(screen.width / 2 - player.x, 0 ? player.y > screen.height / 2 : screen.height / 2 - player.y);
        graph.lineTo(screen.width / 2 - player.x, game.height + screen.height / 2 - player.y);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Top-horizontal.
    if (player.y <= screen.height / 2) {
        graph.beginPath();
        graph.moveTo(0 ? player.x > screen.width / 2 : screen.width / 2 - player.x, screen.height / 2 - player.y);
        graph.lineTo(game.width + screen.width / 2 - player.x, screen.height / 2 - player.y);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Right-vertical.
    if (game.width - player.x <= screen.width / 2) {
        graph.beginPath();
        graph.moveTo(game.width + screen.width / 2 - player.x,
            screen.height / 2 - player.y);
        graph.lineTo(game.width + screen.width / 2 - player.x,
            game.height + screen.height / 2 - player.y);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }

    // Bottom-horizontal.
    if (game.height - player.y <= screen.height / 2) {
        graph.beginPath();
        graph.moveTo(game.width + screen.width / 2 - player.x,
            game.height + screen.height / 2 - player.y);
        graph.lineTo(screen.width / 2 - player.x,
            game.height + screen.height / 2 - player.y);
        graph.strokeStyle = lineColor;
        graph.stroke();
    }
};

const drawErrorMessage = (message, graph, screen) => {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
}

module.exports = {
    drawFood,
    drawVirus,
    drawFireFood,
    drawCells,
    drawErrorMessage,
    drawGrid,
    drawBorder
};