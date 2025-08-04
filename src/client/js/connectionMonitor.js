class ConnectionMonitor {
    constructor(socket) {
        this.socket = socket;
        this.pings = [];
        this.lastPing = null;
        this.lastUpdate = Date.now();
        this.updatesReceived = 0;
        this.seq = 0;

        // Ping-Pong check
        this.socket.on("pongcheck", () => {
            const ping = Date.now() - this.lastPing;

            this.pings.push(ping);
            if (this.pings.length > 20) this.pings.shift();
        });

        // Server update tracking
        this.socket.on("serverTellPlayerMove", () => {
            this.lastUpdate = Date.now();
            this.updatesReceived++;
        });

        // Start monitoring
        setInterval(() => this.sendPing(), 1000);
        setInterval(() => this.report(), 1000);
    }

    sendPing() {
        this.lastPing = Date.now();
        this.socket.emit("pingcheck");
    }

    getPingStats() {
        if (this.pings.length === 0) return { avg: 0, jitter: 0 };
        const avg = this.pings.reduce((a, b) => a + b, 0) / this.pings.length;
        const jitter = Math.max(...this.pings) - Math.min(...this.pings);
        return { avg, jitter };
    }

    getUpdateAge() {
        return Date.now() - this.lastUpdate;
    }

    report() {
        const { avg, jitter } = this.getPingStats();
        const updateAge = this.getUpdateAge();

        const quality = this.getConnectionQuality(
            avg,
            jitter,
            updateAge,
            this.updatesReceived
        );

        console.log(
            `[Connection] Ping: ${avg.toFixed(1)}ms | Jitter: ${jitter.toFixed(
                1
            )}ms | Updates/s: ${
                this.updatesReceived
            } | Last update: ${updateAge}ms ago | Quality: ${quality}`
        );

        this.updatesReceived = 0;
    }

    getConnectionQuality(ping, jitter, updateAge, updatesPerSec) {
        if (updateAge > 500 || updatesPerSec < 5) return "🟥 Bad";
        if (ping > 200 || jitter > 75) return "🟧 Medium";
        return "🟩 Good";
    }
}
module.exports = ConnectionMonitor;
