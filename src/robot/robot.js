module.exports = {

    new: function(controller, server, width, height) {

        var name = controller.name || 'A robot has no name';

        console.log('Creating robot "', name, '" on server', server);

        var global = {
            'name': name,
            'width': width,
            'height': height
        };

        var socket = require("socket.io-client")(server, {query:"type=player"});

        socket.on('connect', function() {
            console.log('Connected');
        });

        socket.on('welcome', function (robotSettings) {
            global.settings = robotSettings;
            robotSettings.name = global.name;
            robotSettings.screenHeight = global.height;
            robotSettings.screenWidth = global.width;
            socket.emit('gotit', robotSettings);
        });


        // Handle error.
        socket.on('connect_failed', function () {
            socket.close();
            console.log('connection failed');
        });

        socket.on('gameSetup', function(data) {
            console.log('gamesetup', data);
        });

        socket.on('serverTellPlayerMove', function (userData, foodsList, massList, virusList) {
            var move = controller.step(userData, foodsList, massList, virusList);
            //console.log('[INFO] Robot name move:', move);

            if (move && move.x && move.y) {
                socket.emit('0', move);
            } else if (move && move == 'split') {
                socket.emit('2');
            } else {
                console.log('[WARN] Robot name, invalid move:', move);
            }
        });

        socket.on('leaderboard', function (data) {
            leaderboard = data.leaderboard;
        });

        // Death.
        socket.on('RIP', function () {
            console.log('you are dead');
        });

        socket.on('kick', function (data) {
            console.log('you got kicked from the game:', data);
        });

        socket.on('virusSplit', function (virusCell) {
            //socket.emit('2', virusCell);
            console.log('virusSplit');
        });

        socket.on('disconnect', function () {
            socket.close();
            console.log('disconnected');
        });

        socket.on('playerDied', function (data) {
            var name = (data.name.length < 1 ? 'An unnamed cell' : data.name);
            console.log('{GAME} - <b>' + name + '</b> was eaten.');
        });

        socket.on('playerDisconnect', function (data) {
            var name = (data.name.length < 1 ? 'An unnamed cell' : data.name);
            console.log('{GAME} - <b>' + name + '</b> disconnected.');
        });

        socket.on('playerJoin', function (data) {
            var name = (data.name.length < 1 ? 'An unnamed cell' : data.name);
            console.log('{GAME} - <b>' + name + '</b> joined.');
        });

        socket.emit('respawn');

        return socket;
    }


};
