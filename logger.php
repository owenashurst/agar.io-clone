<?
 $name = $_GET ['name'];
 $msg = " attempted to login with incorrect password";
 
 $logfile = "logs.txt";
 $txt = $name . $msg;
 $CONST = $txt.PHP_EOL;
 $myfile = file_put_contents($logfile, $CONST , FILE_APPEND | LOCK_EX);
 
 //TODO add in sqli support
?>
