const { mysqlPool } = require("../sql.js");

const logFailedLoginAttempt = async (username, ipAddress) => {
    return new Promise((resolve) => {
        mysqlPool.getConnection((err, connection) => {
            if (err) throw err;

            connection.query(
                "INSERT INTO `failed_login_attempts` (`username`, `ip_address`) VALUES (?, ?)",
                [username, ipAddress],
                (err, results) => {
                    connection.release();
                    if (err) throw err;
                    resolve(results);
                }
            );
        });
    });
};

module.exports = {
    logFailedLoginAttempt,
};
