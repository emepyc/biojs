var express = require("express");
var http = require("http");
var httpProxy = require('http-proxy');

var ebiProxy = httpProxy.createProxyServer(80,'');

var server = express();
server.configure(function () {
    server.use(express.static(__dirname + "/../target/"));
});

server.listen(1337);
http.createServer(server);
console.log("Server running at http://localhost:1337/");