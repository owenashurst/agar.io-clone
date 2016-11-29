<?
 $host = "ec2-54-235-208-104.compute-1.amazonaws.com";
 $user = "bjdodrzoskgdcw";
 $pass = "bHtqPZp8szeyYVkm6y8MMhPuBh";
 $db = "de04uf47ot58ab";
 
 mysql_select ($host, $user, $pass);
 mysql_select_db ($db);
 
 $sql = "
 IF NOT EXISTS (CREATE TABLE users (
`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
name text not null,
level text not null,
xp text not null
);
 ";
 $query = mysql_query ($sql) or die (mysql_error ());
?>
