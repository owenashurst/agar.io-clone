var pg = require ('pg');

var con = "postgres://bjdodrzoskgdcw:bHtqPZp8szeyYVkm6y8MMhPuBh@ec2-54-235-208-104.compute-1.amazonaws.com:5432/de04uf47ot58ab";
pg.defaults.ssl = true;
var client = new pg.Client(process.env.DATABASE_URL);
client.connect (function (err){
 if(err){
 	console.log (err);
     console.log ('Error connecting to pg');
 }
 console.log ('connected to pg');
});