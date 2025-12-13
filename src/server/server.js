/*jslint bitwise: true, node: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const SAT = require('sat');

const gameLogic = require('./game-logic');
const loggingRepositry = require('./repositories/logging-repository');
const chatRepository = require('./repositories/chat-repository');
const config = require('../../config');
const util = require('./lib/util');
const mapUtils = require('./map/map');
const {getPosition} = require("./lib/entityUtils");
const LobbyManager = require('./lobby-manager');
const EventListener = require('./blockchain/event-listener');
const FinalizationJob = require('./finalization-job');
const lobbiesRouter = require('./routes/lobbies');

let map = new mapUtils.Map(config);

let sockets = {};
let spectators = [];
const INIT_MASS_LOG = util.mathLog(config.defaultPlayerMass, config.slowBase);

let leaderboard = [];
let leaderboardChanged = false;

// Track disconnecting players for grace period (network issues vs intentional exit)
const disconnectingPlayers = new Map(); // socketId -> {timestamp, address, lobbyId, reason}
const RECONNECT_GRACE_PERIOD = 30000; // 30 seconds grace period for reconnection

const Vector = SAT.Vector;

app.use(express.static(__dirname + '/../client'));
app.use(express.json());
app.use('/lobbies', lobbiesRouter);

// Serve blockchain config to client
app.get('/api/config', (req, res) => {
    res.json({
        usdcAddress: config.blockchain.usdcAddress,
        betLobbyAddress: config.blockchain.betLobbyAddress,
        chainId: config.blockchain.chainId
    });
});

// Initialize blockchain components
const lobbyManager = new LobbyManager();
const eventListener = new EventListener();
const finalizationJob = new FinalizationJob(lobbyManager, io);

// Start event listener and finalization job
if (eventListener.contract) {
    eventListener.start();
    // Cleanup old deposits every hour
    setInterval(() => eventListener.cleanup(), 60 * 60 * 1000);
}

if (finalizationJob.contractClient) {
    finalizationJob.start();
    // Cleanup old lobbies every hour
    setInterval(() => lobbyManager.cleanupOldLobbies(), 60 * 60 * 1000);
}

io.on('connection', function (socket) {
    let type = socket.handshake.query.type;
    console.log('User has connected: ', type);
    switch (type) {
        case 'player':
            addPlayer(socket);
            break;
        case 'spectator':
            addSpectator(socket);
            break;
        default:
            console.log('Unknown user type, not doing anything.');
    }
});

function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return getPosition(config.newPlayerInitialPosition === 'farthest', radius, map.players.data)
}


const addPlayer = (socket) => {
    var currentPlayer = new mapUtils.playerUtils.Player(socket.id);

    socket.on('gotit', function (clientPlayerData) {
        console.log('[INFO] Player ' + clientPlayerData.name + ' connecting!');
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);

        if (map.players.findIndexByID(socket.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(clientPlayerData.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + clientPlayerData.name + ' connected!');
            sockets[socket.id] = socket;

            const sanitizedName = clientPlayerData.name.replace(/(<([^>]+)>)/ig, '');
            clientPlayerData.name = sanitizedName;

            currentPlayer.clientProvidedData(clientPlayerData);
            map.players.pushNew(currentPlayer);
            io.emit('playerJoin', { name: currentPlayer.name });
            console.log('Total players: ' + map.players.data.length);
        }

    });

    // Blockchain deposit confirmation
    socket.on('playerDepositConfirmed', async function (data) {
        try {
            const { address, txHash, lobbyId } = data;
            
            if (!address || !txHash) {
                socket.emit('serverMSG', 'Invalid deposit data');
                return;
            }

            // Verify deposit via event listener
            console.log(`[Blockchain] Verifying deposit for ${address} in lobby ${lobbyId} (tx: ${txHash})`);
            const verified = eventListener.hasDeposited(address, lobbyId) || 
                            await eventListener.verifyDeposit(address, lobbyId);
            console.log(`[Blockchain] Deposit verified: ${verified}`);

            if (!verified) {
                socket.emit('serverMSG', 'Deposit not verified. Please wait for confirmation.');
                return;
            }

            // Get or create lobby
            const currentLobbyId = lobbyId || lobbyManager.getCurrentLobbyId();
            const lobby = lobbyManager.getLobby(currentLobbyId);

            // Activate lobby if first deposit
            lobbyManager.activateLobby(currentLobbyId);

            // Check if player is reconnecting (was temporarily disconnected)
            const reconnected = lobbyManager.handleReconnection(socket.id, address, currentLobbyId);
            
            if (!reconnected) {
                // New player or not reconnecting - add normally
                lobbyManager.addPlayer(currentLobbyId, socket.id, address, txHash);
            } else {
                console.log(`[Blockchain] Player ${address} reconnected to lobby ${currentLobbyId}`);
            }

            // Set player blockchain data
            currentPlayer.setBlockchainData(address, txHash, config.blockchain.depositAmount);

            // Send lobby end time
            const endTime = lobbyManager.getLobbyEndTime(currentLobbyId);
            if (endTime) {
                socket.emit('lobbyEndTime', { endTime });
                // Broadcast to all players in lobby
                lobby.players.forEach((playerState, playerSocketId) => {
                    if (sockets[playerSocketId]) {
                        sockets[playerSocketId].emit('lobbyEndTime', { endTime });
                    }
                });
            }

            socket.emit('serverMSG', 'Deposit confirmed! Welcome to the lobby.');
            console.log(`[Blockchain] Player ${address} confirmed deposit for lobby ${currentLobbyId}`);
        } catch (error) {
            console.error('[Blockchain] Error handling deposit confirmation:', error);
            socket.emit('serverMSG', 'Error verifying deposit: ' + error.message);
        }
    });

    // Cash out intent
    socket.on('cashOutIntent', function () {
        const success = lobbyManager.handleCashOut(socket.id);
        if (success) {
            socket.emit('serverMSG', 'Cash-out request processed. Your balance is frozen.');
            // Update balance display
            const player = lobbyManager.getPlayer(socket.id);
            if (player) {
                socket.emit('playerBalance', { balance: player.balance });
            }
        } else {
            socket.emit('serverMSG', 'Cash-out failed. Make sure grace period has elapsed and you are alive.');
        }
    });

    socket.on('pingcheck', () => {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', (data) => {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', () => {
        map.players.removePlayerByID(currentPlayer.id);
        socket.emit('welcome', currentPlayer, {
            width: config.gameWidth,
            height: config.gameHeight
        });
        console.log('[INFO] User ' + currentPlayer.name + ' has respawned');
    });

    // Track disconnecting state (fired before disconnect)
    socket.on('disconnecting', (reason) => {
        const lobbyPlayer = lobbyManager.getPlayer(socket.id);
        if (lobbyPlayer && lobbyPlayer.status === 'active') {
            disconnectingPlayers.set(socket.id, {
                timestamp: Date.now(),
                address: lobbyPlayer.address,
                lobbyId: lobbyManager.playerLobbies.get(socket.id),
                reason: reason
            });
            console.log(`[INFO] Player ${currentPlayer.name} disconnecting (reason: ${reason})`);
        }
    });

    socket.on('disconnect', () => {
        map.players.removePlayerByID(currentPlayer.id);
        
        const disconnectInfo = disconnectingPlayers.get(socket.id);
        
        // Check if player reconnected (new socket with same address)
        // This is handled in playerDepositConfirmed if they reconnect
        
        if (disconnectInfo) {
            // Determine if it's a network issue (heartbeat timeout) vs intentional exit
            const isNetworkIssue = disconnectInfo.reason === 'transport close' || 
                                  disconnectInfo.reason === 'ping timeout' ||
                                  disconnectInfo.reason === 'transport error';
            
            if (isNetworkIssue) {
                // Network issue - give grace period for reconnection
                console.log(`[INFO] Network disconnect detected for ${currentPlayer.name}, grace period: ${RECONNECT_GRACE_PERIOD}ms`);
                
                // Mark as temporarily disconnected (preserve balance)
                lobbyManager.markTemporarilyDisconnected(socket.id);
                
                // Set timeout to check if player reconnected
                setTimeout(() => {
                    // Check if player reconnected (by checking if address is still in lobby with active status)
                    const lobby = lobbyManager.getLobby(disconnectInfo.lobbyId);
                    const playerByAddress = lobbyManager.getPlayerByAddress(disconnectInfo.address);
                    
                    if (!playerByAddress || playerByAddress.status === 'temporarily_disconnected') {
                        // Still disconnected after grace period - mark as dead
                        console.log(`[INFO] Player ${disconnectInfo.address} did not reconnect, marking as dead`);
                        lobbyManager.removePlayerPermanently(disconnectInfo.address, disconnectInfo.lobbyId);
                    } else {
                        console.log(`[INFO] Player ${disconnectInfo.address} reconnected successfully`);
                    }
                }, RECONNECT_GRACE_PERIOD);
            } else {
                // Intentional disconnect (tab close, etc.) - immediate death
                console.log(`[INFO] Intentional disconnect for ${currentPlayer.name}, immediate death`);
                lobbyManager.removePlayer(socket.id, null, disconnectInfo.lobbyId);
            }
            
            disconnectingPlayers.delete(socket.id);
        } else {
            // No disconnect info (shouldn't happen, but fallback)
            // Try to get lobby ID first
            const lobbyId = lobbyManager.playerLobbies.get(socket.id);
            lobbyManager.removePlayer(socket.id, null, lobbyId);
        }
        
        console.log('[INFO] User ' + currentPlayer.name + ' has disconnected');
        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', (data) => {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');

        if (config.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }

        socket.broadcast.emit('serverSendPlayerChat', {
            sender: currentPlayer.name,
            message: _message.substring(0, 35)
        });

        chatRepository.logChatMessage(_sender, _message, currentPlayer.ipAddress)
            .catch((err) => console.error("Error when attempting to log chat message", err));
    });

    socket.on('pass', async (data) => {
        const password = data[0];
        if (password === config.adminPass) {
            console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin.');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as an admin.');
            currentPlayer.admin = true;
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with the incorrect password: ' + password);

            socket.emit('serverMSG', 'Password incorrect, attempt logged.');

            loggingRepositry.logFailedLoginAttempt(currentPlayer.name, currentPlayer.ipAddress)
                .catch((err) => console.error("Error when attempting to log failed login attempt", err));
        }
    });

    socket.on('kick', (data) => {
        if (!currentPlayer.admin) {
            socket.emit('serverMSG', 'You are not permitted to use this command.');
            return;
        }

        var reason = '';
        var worked = false;
        for (let playerIndex in map.players.data) {
            let player = map.players.data[playerIndex];
            if (player.name === data[0] && !player.admin && !worked) {
                if (data.length > 1) {
                    for (var f = 1; f < data.length; f++) {
                        if (f === data.length) {
                            reason = reason + data[f];
                        }
                        else {
                            reason = reason + data[f] + ' ';
                        }
                    }
                }
                if (reason !== '') {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
                }
                else {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name);
                }
                socket.emit('serverMSG', 'User ' + player.name + ' was kicked by ' + currentPlayer.name);
                sockets[player.id].emit('kick', reason);
                sockets[player.id].disconnect();
                map.players.removePlayerByIndex(playerIndex);
                worked = true;
            }
        }
        if (!worked) {
            socket.emit('serverMSG', 'Could not locate user or user is an admin.');
        }
    });

    // Heartbeat function, update everytime.
    socket.on('0', (target) => {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function () {
        // Fire food.
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    socket.on('2', () => {
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });
}

const addSpectator = (socket) => {
    socket.on('gotit', function () {
        sockets[socket.id] = socket;
        spectators.push(socket.id);
        io.emit('playerJoin', { name: '' });
    });

    socket.emit("welcome", {}, {
        width: config.gameWidth,
        height: config.gameHeight
    });
}

const tickPlayer = (currentPlayer) => {
    const heartbeatTimeout = new Date().getTime() - config.maxHeartbeatInterval;
    if (currentPlayer.lastHeartbeat < heartbeatTimeout) {
        // Heartbeat timeout - this will trigger disconnect with 'ping timeout' reason
        // The disconnect handler will check if it's network issue and apply grace period
        sockets[currentPlayer.id].emit('kick', 'Connection timeout. Reconnecting...');
        sockets[currentPlayer.id].disconnect(true); // Force disconnect
    }

    currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

    const isEntityInsideCircle = (point, circle) => {
        return SAT.pointInCircle(new Vector(point.x, point.y), circle);
    };

    const canEatMass = (cell, cellCircle, cellIndex, mass) => {
        if (isEntityInsideCircle(mass, cellCircle)) {
            if (mass.id === currentPlayer.id && mass.speed > 0 && cellIndex === mass.num)
                return false;
            if (cell.mass > mass.mass * 1.1)
                return true;
        }

        return false;
    };

    const canEatVirus = (cell, cellCircle, virus) => {
        return virus.mass < cell.mass && isEntityInsideCircle(virus, cellCircle)
    }

    const cellsToSplit = [];
    for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
        const currentCell = currentPlayer.cells[cellIndex];

        const cellCircle = currentCell.toCircle();

        const eatenFoodIndexes = util.getIndexes(map.food.data, food => isEntityInsideCircle(food, cellCircle));
        const eatenMassIndexes = util.getIndexes(map.massFood.data, mass => canEatMass(currentCell, cellCircle, cellIndex, mass));
        const eatenVirusIndexes = util.getIndexes(map.viruses.data, virus => canEatVirus(currentCell, cellCircle, virus));

        if (eatenVirusIndexes.length > 0) {
            cellsToSplit.push(cellIndex);
            map.viruses.delete(eatenVirusIndexes)
        }

        let massGained = eatenMassIndexes.reduce((acc, index) => acc + map.massFood.data[index].mass, 0);

        map.food.delete(eatenFoodIndexes);
        map.massFood.remove(eatenMassIndexes);
        massGained += (eatenFoodIndexes.length * config.foodMass);
        currentPlayer.changeCellMass(cellIndex, massGained);
    }
    currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
};

const tickGame = () => {
    map.players.data.forEach(tickPlayer);
    map.massFood.move(config.gameWidth, config.gameHeight);

    map.players.handleCollisions(function (gotEaten, eater) {
        const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);

        map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, cellGotEaten.mass);

        const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (playerDied) {
            let playerGotEaten = map.players.data[gotEaten.playerIndex];
            let playerEater = map.players.data[eater.playerIndex];
            
            // Update balances in lobby manager
            lobbyManager.handleKill(playerEater.id, playerGotEaten.id);
            
            // Update player balance fields
            const lobbyPlayerEater = lobbyManager.getPlayer(playerEater.id);
            const lobbyPlayerVictim = lobbyManager.getPlayer(playerGotEaten.id);
            
            if (lobbyPlayerEater && lobbyPlayerVictim) {
                playerEater.balance = lobbyPlayerEater.balance;
                playerGotEaten.balance = 0;
                
                // Send balance update to killer
                sockets[playerEater.id].emit('playerBalance', { balance: lobbyPlayerEater.balance });
            }
            
            io.emit('playerDied', { name: playerGotEaten.name }); //TODO: on client it is `playerEatenName` instead of `name`
            sockets[playerGotEaten.id].emit('RIP');
            map.players.removePlayerByIndex(gotEaten.playerIndex);
        }
    });

};

const calculateLeaderboard = () => {
    const topPlayers = map.players.getTopPlayers();

    if (leaderboard.length !== topPlayers.length) {
        leaderboard = topPlayers;
        leaderboardChanged = true;
    } else {
        for (let i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].id !== topPlayers[i].id) {
                leaderboard = topPlayers;
                leaderboardChanged = true;
                break;
            }
        }
    }
}

const gameloop = () => {
    if (map.players.data.length > 0) {
        calculateLeaderboard();
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);
    }

    map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);
};

const sendUpdates = () => {
    spectators.forEach(updateSpectator);
    map.enumerateWhatPlayersSee(function (playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
        // Get current player's lobby ID
        const currentPlayerLobbyId = lobbyManager.playerLobbies.get(playerData.id) || null;
        
        // Add lobby ID to current player data
        playerData.lobbyId = currentPlayerLobbyId;
        
        // Add lobby IDs to visible players
        const visiblePlayersWithLobby = visiblePlayers.map(player => {
            const playerLobbyId = lobbyManager.playerLobbies.get(player.id) || null;
            return {
                ...player,
                lobbyId: playerLobbyId
            };
        });
        
        sockets[playerData.id].emit('serverTellPlayerMove', playerData, visiblePlayersWithLobby, visibleFood, visibleMass, visibleViruses);
        if (leaderboardChanged) {
            sendLeaderboard(sockets[playerData.id]);
        }
        
        // Send balance update if player is in a lobby
        const lobbyPlayer = lobbyManager.getPlayer(playerData.id);
        if (lobbyPlayer && lobbyPlayer.balance !== undefined) {
            sockets[playerData.id].emit('playerBalance', { balance: lobbyPlayer.balance });
        }
    });

    leaderboardChanged = false;
};

const sendLeaderboard = (socket) => {
    socket.emit('leaderboard', {
        players: map.players.data.length,
        leaderboard
    });
}
const updateSpectator = (socketID) => {
    let playerData = {
        x: config.gameWidth / 2,
        y: config.gameHeight / 2,
        cells: [],
        massTotal: 0,
        hue: 100,
        id: socketID,
        name: ''
    };
    sockets[socketID].emit('serverTellPlayerMove', playerData, map.players.data, map.food.data, map.massFood.data, map.viruses.data);
    if (leaderboardChanged) {
        sendLeaderboard(sockets[socketID]);
    }
}

setInterval(tickGame, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / config.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
http.listen(serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));
