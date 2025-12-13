'use strict';

const { ethers } = require('ethers');
const config = require('../../../config');

// BetLobby ABI for events
const BET_LOBBY_ABI = [
    "event LobbyJoined(uint256 indexed lobbyId, address indexed player)",
    "event LobbyActivated(uint256 indexed lobbyId, uint64 startTime, uint64 endTime)"
];

/**
 * Event Listener
 * Watches blockchain events to verify deposits before allowing socket connection
 */
class EventListener {
    constructor() {
        this.provider = null;
        this.contract = null;
        this.isListening = false;
        this.deposits = new Map(); // Map<address.toLowerCase(), {lobbyId, txHash, blockNumber}>
        
        if (!config.blockchain.rpcUrl || !config.blockchain.betLobbyAddress) {
            console.warn('[EventListener] Blockchain not configured, event listener disabled');
            return;
        }

        this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
        this.contract = new ethers.Contract(
            config.blockchain.betLobbyAddress,
            BET_LOBBY_ABI,
            this.provider
        );
    }

    /**
     * Start listening for LobbyJoined events
     */
    start() {
        if (!this.contract || this.isListening) {
            return;
        }

        this.isListening = true;
        console.log('[EventListener] Starting to listen for LobbyJoined events');

        // Listen for new events
        this.contract.on('LobbyJoined', (lobbyId, player, event) => {
            const address = player.toLowerCase();
            const depositInfo = {
                lobbyId: lobbyId.toString(),
                address,
                txHash: event.transactionHash,
                blockNumber: event.blockNumber,
                timestamp: Date.now()
            };

            this.deposits.set(address, depositInfo);
            console.log(`[EventListener] Deposit detected: ${address} joined lobby ${lobbyId} in tx ${event.transactionHash}`);
        });

        // Also listen for LobbyActivated events
        this.contract.on('LobbyActivated', (lobbyId, startTime, endTime, event) => {
            console.log(`[EventListener] Lobby ${lobbyId} activated at block ${event.blockNumber}`);
        });
    }

    /**
     * Stop listening for events
     */
    stop() {
        if (!this.contract || !this.isListening) {
            return;
        }

        this.contract.removeAllListeners();
        this.isListening = false;
        console.log('[EventListener] Stopped listening for events');
    }

    /**
     * Check if an address has deposited to a specific lobby
     * @param {string} address - Ethereum address
     * @param {number} lobbyId - Lobby ID
     * @returns {boolean} True if deposit exists
     */
    hasDeposited(address, lobbyId) {
        const normalizedAddress = address.toLowerCase();
        const deposit = this.deposits.get(normalizedAddress);
        
        if (!deposit) {
            return false;
        }

        return deposit.lobbyId === lobbyId.toString();
    }

    /**
     * Get deposit info for an address
     * @param {string} address - Ethereum address
     * @returns {Object|null} Deposit info or null
     */
    getDeposit(address) {
        const normalizedAddress = address.toLowerCase();
        return this.deposits.get(normalizedAddress) || null;
    }

    /**
     * Verify deposit by querying the contract (fallback if event missed)
     * @param {string} address - Ethereum address
     * @param {number} lobbyId - Lobby ID
     * @returns {Promise<boolean>} True if deposit verified
     */
    async verifyDeposit(address, lobbyId) {
        if (!this.contract) {
            return false;
        }

        try {
            console.log(`[EventListener] Verifying deposit for ${address} in lobby ${lobbyId}`);
            // Query LobbyJoined events for this address and lobby
            // Ensure lobbyId is treated correctly (try both number and BigNumber if needed, but Ethers handles it)
            const filter = this.contract.filters.LobbyJoined(lobbyId, address);
            const events = await this.contract.queryFilter(filter, 0, 'latest');
            
            console.log(`[EventListener] Found ${events.length} events for ${address} in lobby ${lobbyId}`);

            if (events.length > 0) {
                const event = events[events.length - 1]; // Get most recent
                const depositInfo = {
                    lobbyId: lobbyId.toString(),
                    address: address.toLowerCase(),
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: Date.now()
                };

                this.deposits.set(address.toLowerCase(), depositInfo);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[EventListener] Error verifying deposit:', error);
            return false;
        }
    }

    /**
     * Clear old deposits (older than 1 hour)
     */
    cleanup() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        let cleaned = 0;

        for (const [address, deposit] of this.deposits.entries()) {
            if (deposit.timestamp < oneHourAgo) {
                this.deposits.delete(address);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[EventListener] Cleaned up ${cleaned} old deposits`);
        }
    }
}

module.exports = EventListener;

