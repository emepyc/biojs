var express = require("express");
var http = require("http");
var server = express();

server.configure(function () {
    server.use(express.static(__dirname + "/../target/"));
});

server.listen(1337);
http.createServer(server);
console.log("Server running at http://localhost:1337/");