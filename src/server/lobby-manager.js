'use strict';

const config = require('../../config');

/**
 * Lobby State Manager
 * Tracks lobby lifecycle, player balances, and state transitions
 */
class LobbyManager {
    constructor() {
        // Map<lobbyId, LobbyState>
        this.lobbies = new Map();
        
        // Map<socketId, lobbyId> - track which lobby a player is in
        this.playerLobbies = new Map();
        
        // Map<address, lobbyId> - track which lobby an address deposited to
        this.addressLobbies = new Map();
    }

    /**
     * Generate deterministic lobby ID based on current time
     * Each lobby lasts 5 minutes, so we bucket by 5-minute intervals
     */
    getCurrentLobbyId() {
        const lobbyDurationMs = config.blockchain.lobbyDuration * 1000;
        return Math.floor(Date.now() / lobbyDurationMs);
    }

    /**
     * Get or create lobby state
     * @param {number} lobbyId - Lobby ID
     * @returns {Object} LobbyState
     */
    getLobby(lobbyId) {
        if (!this.lobbies.has(lobbyId)) {
            this.lobbies.set(lobbyId, {
                id: lobbyId,
                startTime: null,
                endTime: null,
                state: 'waiting', // waiting | active | finalizable | finalized
                players: new Map(), // Map<socketId, PlayerState>
                balances: new Map(), // Map<address, {amount, status}>
                cashOutGraceSeconds: config.blockchain.cashOutGraceSeconds || 45
            });
        }
        return this.lobbies.get(lobbyId);
    }

    /**
     * Activate lobby on first deposit
     * @param {number} lobbyId - Lobby ID
     */
    activateLobby(lobbyId) {
        const lobby = this.getLobby(lobbyId);
        if (lobby.state === 'waiting') {
            lobby.startTime = Date.now();
            lobby.endTime = lobby.startTime + (config.blockchain.lobbyDuration * 1000);
            lobby.state = 'active';
            console.log(`[Lobby] Activated lobby ${lobbyId} at ${new Date(lobby.startTime).toISOString()}`);
        }
    }

    /**
     * Add player to lobby after deposit confirmation
     * @param {number} lobbyId - Lobby ID
     * @param {string} socketId - Socket ID
     * @param {string} address - Ethereum address
     * @param {string} depositTx - Deposit transaction hash
     */
    addPlayer(lobbyId, socketId, address, depositTx) {
        console.log(`[LobbyManager] addPlayer called for lobby ${lobbyId}, socket ${socketId}, address ${address}`);
        const lobby = this.getLobby(lobbyId);
        
        // Initialize player state
        lobby.players.set(socketId, {
            socketId,
            address,
            depositTx,
            balance: config.blockchain.depositAmount, // Start with 1 USDC
            status: 'active', // active | frozen | dead
            joinedAt: Date.now()
        });

        // Initialize balance tracking
        if (!lobby.balances.has(address)) {
            lobby.balances.set(address, {
                amount: config.blockchain.depositAmount,
                status: 'active'
            });
        }

        // Track mappings
        this.playerLobbies.set(socketId, lobbyId);
        this.addressLobbies.set(address.toLowerCase(), lobbyId);

        console.log(`[Lobby] Player ${address} joined lobby ${lobbyId} (socket: ${socketId})`);
    }

    /**
     * Mark player as temporarily disconnected (preserve balance during grace period)
     * @param {string} socketId - Socket ID
     */
    markTemporarilyDisconnected(socketId) {
        const lobbyId = this.playerLobbies.get(socketId);
        if (!lobbyId) return;

        const lobby = this.getLobby(lobbyId);
        const player = lobby.players.get(socketId);
        
        if (player && player.status === 'active') {
            player.status = 'temporarily_disconnected';
            // Balance is preserved - don't set to 0
            console.log(`[Lobby] Player ${player.address} marked as temporarily disconnected (balance preserved)`);
        }
    }

    /**
     * Remove player permanently from lobby (intentional exit or grace period expired)
     * @param {string} socketId - Socket ID (optional, can use address instead)
     * @param {string} address - Ethereum address (optional, used if socketId not found)
     * @param {number} lobbyId - Lobby ID (optional, looked up if not provided)
     */
    removePlayer(socketId = null, address = null, lobbyId = null) {
        let targetSocketId = socketId;
        let targetLobbyId = lobbyId;
        
        // If socketId provided, use it
        if (socketId) {
            targetLobbyId = this.playerLobbies.get(socketId);
        } else if (address) {
            // Look up by address
            targetLobbyId = this.addressLobbies.get(address.toLowerCase());
            if (targetLobbyId) {
                const lobby = this.getLobby(targetLobbyId);
                for (const [sid, player] of lobby.players.entries()) {
                    if (player.address.toLowerCase() === address.toLowerCase()) {
                        targetSocketId = sid;
                        break;
                    }
                }
            }
        }
        
        if (!targetLobbyId || !targetSocketId) return;

        const lobby = this.getLobby(targetLobbyId);
        const player = lobby.players.get(targetSocketId);
        
        if (player) {
            // Update balance status to dead if not already frozen
            if (player.status === 'active' || player.status === 'temporarily_disconnected') {
                const balance = lobby.balances.get(player.address);
                if (balance) {
                    balance.status = 'dead';
                    balance.amount = 0;
                }
                player.status = 'dead';
                player.balance = 0;
                console.log(`[Lobby] Player ${player.address} permanently removed (balance set to 0)`);
            }
            
            lobby.players.delete(targetSocketId);
        }

        this.playerLobbies.delete(targetSocketId);
    }

    /**
     * Remove player permanently by address (used after grace period expires)
     * @param {string} address - Ethereum address
     * @param {number} lobbyId - Lobby ID
     */
    removePlayerPermanently(address, lobbyId) {
        this.removePlayer(null, address, lobbyId);
    }

    /**
     * Handle player reconnection - restore balance if within grace period
     * @param {string} socketId - New socket ID
     * @param {string} address - Ethereum address
     * @param {number} lobbyId - Lobby ID
     * @returns {boolean} True if reconnection was handled
     */
    handleReconnection(socketId, address, lobbyId) {
        const lobby = this.getLobby(lobbyId);
        const normalizedAddress = address.toLowerCase();
        
        // Find player by address with temporarily_disconnected status
        for (const [oldSocketId, playerState] of lobby.players.entries()) {
            if (playerState.address.toLowerCase() === normalizedAddress && 
                playerState.status === 'temporarily_disconnected') {
                
                // Restore player with new socket ID
                playerState.socketId = socketId;
                playerState.status = 'active';
                // Balance is already preserved, no need to restore
                
                // Update mappings
                lobby.players.delete(oldSocketId);
                lobby.players.set(socketId, playerState);
                this.playerLobbies.delete(oldSocketId);
                this.playerLobbies.set(socketId, lobbyId);
                
                // Update balance status back to active
                const balance = lobby.balances.get(normalizedAddress);
                if (balance) {
                    balance.status = 'active';
                }
                
                console.log(`[Lobby] Player ${address} reconnected, balance restored: ${playerState.balance}`);
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get player by socket ID
     * @param {string} socketId - Socket ID
     * @returns {Object|null} PlayerState or null
     */
    getPlayer(socketId) {
        const lobbyId = this.playerLobbies.get(socketId);
        if (!lobbyId) return null;

        const lobby = this.getLobby(lobbyId);
        return lobby.players.get(socketId) || null;
    }

    /**
     * Get player by address
     * @param {string} address - Ethereum address
     * @returns {Object|null} PlayerState or null
     */
    getPlayerByAddress(address) {
        const lobbyId = this.addressLobbies.get(address.toLowerCase());
        if (!lobbyId) return null;

        const lobby = this.getLobby(lobbyId);
        for (const player of lobby.players.values()) {
            if (player.address.toLowerCase() === address.toLowerCase()) {
                return player;
            }
        }
        return null;
    }

    /**
     * Update balance on kill event
     * @param {string} killerSocketId - Killer's socket ID
     * @param {string} victimSocketId - Victim's socket ID
     */
    handleKill(killerSocketId, victimSocketId) {
        const killerLobbyId = this.playerLobbies.get(killerSocketId);
        const victimLobbyId = this.playerLobbies.get(victimSocketId);

        // Both players must be in the same lobby
        if (!killerLobbyId || killerLobbyId !== victimLobbyId) return;

        const lobby = this.getLobby(killerLobbyId);
        const killer = lobby.players.get(killerSocketId);
        const victim = lobby.players.get(victimSocketId);

        // Don't allow killing temporarily disconnected players (they're not in game)
        if (!killer || !victim || victim.status !== 'active') return;

        // Transfer victim's entire balance to killer
        const victimBalance = victim.balance;
        killer.balance += victimBalance;
        victim.balance = 0;
        victim.status = 'dead';

        // Update balance maps
        const killerBalance = lobby.balances.get(killer.address);
        const victimBalanceEntry = lobby.balances.get(victim.address);
        
        if (killerBalance) {
            killerBalance.amount = killer.balance;
        }
        if (victimBalanceEntry) {
            victimBalanceEntry.amount = 0;
            victimBalanceEntry.status = 'dead';
        }

        console.log(`[Lobby] Kill in lobby ${killerLobbyId}: ${killer.address} killed ${victim.address} (${victimBalance} USDC transferred)`);
    }

    /**
     * Handle cash-out request
     * @param {string} socketId - Socket ID
     * @returns {boolean} Success
     */
    handleCashOut(socketId) {
        const lobbyId = this.playerLobbies.get(socketId);
        if (!lobbyId) return false;

        const lobby = this.getLobby(lobbyId);
        const player = lobby.players.get(socketId);

        if (!player || player.status !== 'active') return false;

        // Check lobby is active
        if (lobby.state !== 'active') return false;

        // Check grace period has elapsed
        const gracePeriodMs = lobby.cashOutGraceSeconds * 1000;
        if (Date.now() < lobby.startTime + gracePeriodMs) {
            return false;
        }

        // Freeze balance
        player.status = 'frozen';
        const balance = lobby.balances.get(player.address);
        if (balance) {
            balance.status = 'frozen';
            // Balance amount stays the same (frozen at current value)
        }

        console.log(`[Lobby] Cash-out in lobby ${lobbyId}: ${player.address} froze balance of ${player.balance} USDC`);
        return true;
    }

    /**
     * Get final balances snapshot for Merkle tree
     * @param {number} lobbyId - Lobby ID
     * @returns {Array} Array of {address, amount} sorted by address
     */
    getFinalBalances(lobbyId) {
        const lobby = this.getLobby(lobbyId);
        const balances = [];

        // Collect all balances (including dead players with 0)
        for (const [address, balance] of lobby.balances.entries()) {
            // Handle temporarily_disconnected players - if still disconnected, treat as dead
            // Otherwise, use their current status
            let finalAmount = 0;
            if (balance.status === 'frozen') {
                finalAmount = balance.amount;
            } else if (balance.status === 'active') {
                finalAmount = balance.amount;
            } else if (balance.status === 'temporarily_disconnected') {
                // Check if player is still disconnected - if so, set to 0
                // This handles cases where grace period expired during finalization
                finalAmount = 0;
            } else {
                // 'dead' status
                finalAmount = 0;
            }
            
            balances.push({
                address: address.toLowerCase(),
                amount: finalAmount
            });
        }

        // Sort by address for deterministic ordering
        balances.sort((a, b) => {
            if (a.address < b.address) return -1;
            if (a.address > b.address) return 1;
            return 0;
        });

        return balances;
    }

    /**
     * Mark lobby as finalizable
     * @param {number} lobbyId - Lobby ID
     */
    markFinalizable(lobbyId) {
        const lobby = this.getLobby(lobbyId);
        if (lobby.state === 'active') {
            lobby.state = 'finalizable';
        }
    }

    /**
     * Mark lobby as finalized
     * @param {number} lobbyId - Lobby ID
     */
    markFinalized(lobbyId) {
        const lobby = this.getLobby(lobbyId);
        lobby.state = 'finalized';
    }

    /**
     * Get all lobbies ready for finalization (endTime <= now)
     * @returns {Array} Array of lobby IDs
     */
    getLobbiesReadyForFinalization() {
        const now = Date.now();
        const ready = [];

        for (const [lobbyId, lobby] of this.lobbies.entries()) {
            if (lobby.state === 'active' && lobby.endTime && lobby.endTime <= now) {
                ready.push(lobbyId);
            }
        }

        return ready;
    }

    /**
     * Get lobby end time for countdown
     * @param {number} lobbyId - Lobby ID
     * @returns {number|null} End time timestamp or null
     */
    getLobbyEndTime(lobbyId) {
        const lobby = this.getLobby(lobbyId);
        return lobby.endTime;
    }

    /**
     * Remove all players in a lobby from the game map
     * Force disconnects players when lobby ends
     * @param {number} lobbyId - Lobby ID
     * @param {Object} io - Socket.IO instance
     */
    despawnLobbyPlayers(lobbyId, io) {
        const lobby = this.getLobby(lobbyId);
        if (!lobby || !lobby.players) return;

        // Calculate final balances for display
        const finalBalances = this.getFinalBalances(lobbyId);
        const balanceMap = new Map(finalBalances.map(b => [b.address.toLowerCase(), b.amount]));

        for (const [socketId, playerState] of lobby.players.entries()) {
            // 1. Notify Client Game is Over
            const socket = io && io.sockets.sockets.get(socketId);
            if (socket) {
                // Get player's final balance
                const balance = balanceMap.get(playerState.address.toLowerCase()) || 0;
                
                // Send lobbyEnded event instead of kick/disconnect
                socket.emit('lobbyEnded', {
                    reason: 'Lobby Ended! Distributing Rewards...',
                    balance: balance,
                    isWinner: balance > 0
                });
                
                // We DO NOT disconnect here anymore. 
                // We let the client see the results modal.
            }

            // 2. Remove from internal maps (Logic handled by disconnect handler usually, 
            // but we force it here to be sure)
            this.removePlayer(socketId, null, lobbyId);
        }
        
        console.log(`[Lobby] Despawned all players from Lobby ${lobbyId}`);
    }

    /**
     * Clean up old lobbies (older than 1 hour)
     */
    cleanupOldLobbies() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const [lobbyId, lobby] of this.lobbies.entries()) {
            if (lobby.endTime && lobby.endTime < oneHourAgo && lobby.state === 'finalized') {
                // Remove player mappings
                for (const player of lobby.players.values()) {
                    this.playerLobbies.delete(player.socketId);
                    this.addressLobbies.delete(player.address.toLowerCase());
                }
                
                this.lobbies.delete(lobbyId);
                console.log(`[Lobby] Cleaned up old lobby ${lobbyId}`);
            }
        }
    }
}

module.exports = LobbyManager;

