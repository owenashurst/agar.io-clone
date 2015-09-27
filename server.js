var express = require('express');
var webpack = require('webpack');
var config = require('./webpack.config.js');
var compiler = webpack(config);
var path = require('path');
var app = express();
var isProduction = process.env.NODE_ENV === 'production';
var port = isProduction ? process.env.PORT : 3000;
var publicPath = path.resolve(__dirname, 'public');

app.use(express.static(publicPath));

if (!isProduction) {
  app.use(require('webpack-dev-middleware')(compiler, {
    noInfo: true,
    hot: true,
    publicPath: config.output.publicPath
  }));

  app.use(require('webpack-hot-middleware')(compiler));
}


// And run the server
app.listen(port, function () {
  console.log('Server running on port ' + port);
});
