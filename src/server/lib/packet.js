/* jslint node: true */
'use strict';

exports.create = {};
exports.parse = {};

exports.create.hi = function () {
    var view = new DataView(new ArrayBuffer(1));
    view.setUint8(0, 2);
    return view.buffer;
};

exports.create.welcome = function (player, conf) {
    var view = new DataView(new ArrayBuffer(1 + 4 + 4 + 4 + 4 + 2 + 6));
    view.setUint8(0, 0);
    view.setUint32(1, conf.gameWidth);
    view.setUint32(5, conf.gameHeight);
    view.setUint32(9, player.x);
    view.setUint32(13, player.y);
    view.setUint16(17, player.mass);
    view.setUint8(19, parseInt(player.color.fill.substring(1, 3), 16));
    view.setUint8(20, parseInt(player.color.fill.substring(3, 5), 16));
    view.setUint8(21, parseInt(player.color.fill.substring(5), 16));
    view.setUint8(22, parseInt(player.color.border.substring(1, 3), 16));
    view.setUint8(23, parseInt(player.color.border.substring(3, 5), 16));
    view.setUint8(24, parseInt(player.color.border.substring(5), 16));
    return view.buffer;
};

exports.create.kick = function (type) {
    var view = new DataView(new ArrayBuffer(1 + 1));
    view.setUint8(0, 41);
    view.setUint8(1, type);
    return view.buffer;
};

exports.create.message = function (str, type) {
    var view = new DataView(new ArrayBuffer(1 + 4 * str.length));
    view.setUint8(0, typeof type != 'number' ? 30 : Math.round(type));
    for (var i = 0; i < str.length; i++) {
        view.setUint16(1 + 2 * i, str.charCodeAt(i));
    }
    return view.buffer;
};

exports.create.addFood = function (food) {
    var view = new DataView(new ArrayBuffer(1 + 16 + 4 + 4 + 6));
    view.setUint8(0, 22);
    for (var i = 0; i < 16; i++) {
        view.setUint8(1 + i, parseInt(food.id.substring(2*i, 2+2*i), 16));
    }
    view.setUint32(17, food.x);
    view.setUint32(21, food.y);
    view.setUint8(25, parseInt(food.color.fill.substring(1, 3), 16));
    view.setUint8(26, parseInt(food.color.fill.substring(3, 5), 16));
    view.setUint8(27, parseInt(food.color.fill.substring(5), 16));
    view.setUint8(28, parseInt(food.color.border.substring(1, 3), 16));
    view.setUint8(29, parseInt(food.color.border.substring(3, 5), 16));
    view.setUint8(30, parseInt(food.color.border.substring(5), 16));
    return view.buffer;
};

exports.create.removeFood = function (id) {
    var view = new DataView(new ArrayBuffer(1 + 16));
    view.setUint8(0, 23);
    for (var i = 0; i < 16; i++) {
        view.setUint8(1 + i, parseInt(id.substring(2*i, 2+2*i), 16));
    }
    return view.buffer;
};

exports.create.addEnemy = function (enemy) {
    var view = new DataView(new ArrayBuffer(1 + 16 + 4 + 4 + 6 + 2 + enemy.name.length * 2));
    view.setUint8(0, 22);
    for (var i = 0; i < 16; i++) {
        view.setUint8(1 + i, parseInt(enemy.id.substring(2*i, 2+2*i), 16));
    }
    view.setUint32(17, enemy.x);
    view.setUint32(21, enemy.y);
    view.setUint8(25, parseInt(enemy.color.fill.substring(1, 3), 16));
    view.setUint8(26, parseInt(enemy.color.fill.substring(3, 5), 16));
    view.setUint8(27, parseInt(enemy.color.fill.substring(5), 16));
    view.setUint8(28, parseInt(enemy.color.border.substring(1, 3), 16));
    view.setUint8(29, parseInt(enemy.color.border.substring(3, 5), 16));
    view.setUint8(30, parseInt(enemy.color.border.substring(5), 16));
    view.setUint16(31, enemy.mass);
    for (i = 0; i < enemy.name.length; i++) {
        view.setUint16(33 + 2 * i, enemy.name.charCodeAt(i));
    }
    return view.buffer;
};

exports.create.removeEnemy = function (id) {
    var view = new DataView(new ArrayBuffer(1 + 16));
    view.setUint8(0, 21);
    for (var i = 0; i < 16; i++) {
        view.setUint8(1 + i, parseInt(id.substring(2*i, 2+2*i), 16));
    }
    return view.buffer;
};

exports.create.updatePlayer = function (x, y, mass, id) {
    var view = new DataView(new ArrayBuffer(1 + 16));
    view.setUint8(0, 10);
    view.setUint32(1, x);
    view.setUint32(5, y);
    view.setUint16(9, mass);
    if(typeof id != 'undefined') {
        for (var i = 0; i < 16; i++) {
            view.setUint8(11 + i, parseInt(id.substring(2*i, 2+2*i), 16));
        }
    }
    return view.buffer;
};

exports.parse.screen = function (data, offset) {
    if(typeof offset == 'undefined') {
        offset = 1;
    }
    return {
        x: data.getUint16(offset),
        y: data.getUint16(offset + 2)
    };
};

exports.parse.message = function (data, begin, end){
    if (typeof end == 'undefined') {
        end = data.byteLength;
    }
    else {
        end = Math.min(data.byteLength, end);
    }
    if (typeof begin == 'undefined') {
        begin = 0;
    }
    var str = "";
    var code = 0;
    for (var i = begin; i < end; i+=2) {
        code = data.getUint16(i);
        if (code === 0) {
            break;
        }
        str += String.fromCharCode(code);
    }
    return str;
};
