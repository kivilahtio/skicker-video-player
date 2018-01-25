//https://raw.githubusercontent.com/glenjamin/webpack-hot-middleware/master/example/server.js

var http = require('http');

var express = require('express');

var app = express();

app.use(require('morgan')('short'));


var webpack = require('webpack');
var webpackConfig = require(process.env.WEBPACK_CONFIG ? process.env.WEBPACK_CONFIG : './webpack.config');

// ************************************
// This is the real meat of the example
// ************************************
(function() {

  // Step 1: Create & configure a webpack compiler
  var compiler = webpack(webpackConfig);

  // Step 2: Attach the dev middleware to the compiler & the server
  app.use(require("webpack-dev-middleware")(compiler, {
    noInfo: true, publicPath: webpackConfig.output.publicPath
  }));

  // Step 3: Attach the hot middleware to the compiler & the server
  app.use(require("webpack-hot-middleware")(compiler, {
    log: console.log, path: '/__webpack_hmr', heartbeat: 10 * 1000
  }));
})();

// Do anything you like with the rest of your express application.

app.get("/", function(req, res) {
  res.sendFile(__dirname + '/index.html');
});
app.get("/multientry", function(req, res) {
  res.sendFile(__dirname + '/index-multientry.html');
});

if (require.main === module) {
  var server = http.createServer(app);
  server.listen(process.env.PORT || webpackConfig.devServer.port, function() {
    console.log("Listening on %j", server.address());
  });
}
