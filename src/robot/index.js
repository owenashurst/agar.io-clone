// Import game settings.
var c = require('../../config.json');
var robot = require('./robot');
var glob = require("glob");
var path = require('path');

var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || c.port;

// Init socket communication
var server = 'http://' + ipaddress + ':' + serverport;

// store all robots playing
var robots = [];

var width = c.gameWidth / 4;
var height = c.gameHeight / 4;

var robots_dir = path.resolve(__dirname, "./robots/*.js");

glob.sync(robots_dir).forEach(function(file) {
    var controller = require(file);
    robots.push({
        'module': robot,
        'socket': robot.new(controller, server, width, height)
    });
});
