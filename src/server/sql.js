const mysql = require ("mysql");
const config = require("../../config");

const sqlInfo = config.sqlinfo;

const mysqlPool = mysql.createPool({
    connectionLimit: 100,
    host: sqlInfo.host,
    user: sqlInfo.user,
    password: sqlInfo.password,
    database: sqlInfo.database,
});

mysqlPool.on('acquire', (connection) => {
    console.log('Connection %d acquired.', connection.threadId);
});

mysqlPool.on('release', (connection) => {
    console.log('Connection %d released.', connection.threadId);
});

module.exports = {
    mysqlPool,
};