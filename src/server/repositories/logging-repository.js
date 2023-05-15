const db = require("../sql.js");

const logFailedLoginAttempt = async (username, ipAddress) => {
    return new Promise((resolve) => {
        db.run(
            "INSERT INTO failed_login_attempts (username, ip_address) VALUES (?, ?)",
            [username, ipAddress],
            (err) => {
                if (err) console.error(err);
                resolve();
            }
        );
    });
};

module.exports = {
    logFailedLoginAttempt,
};
