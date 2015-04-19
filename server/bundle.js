var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var webpackConfig = require('./../webpack.config.js');
var path = require('path');
var fs = require('fs');
var mainPath = path.resolve(__dirname, '..', 'app', 'main.js');

module.exports = function () {

  var compiler = webpack(webpackConfig, function () {
    fs.writeFileSync(mainPath, fs.readFileSync(mainPath).toString());
    console.log('Project is ready!');
  });

  var bundler = new WebpackDevServer(compiler, {
    publicPath: '/build',
    inline: true,
    hot: true,
    quiet: false,
    noInfo: true,
    stats: {
      colors: true
    }
  });

  bundler.listen(8080, 'localhost', function () {
    console.log('Bundling project, please wait...');
  });

};
