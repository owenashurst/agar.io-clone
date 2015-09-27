# webpack-express-boilerplate
A boilerplate for running a Webpack workflow in Node express

Please read the following article: [The ultimate Webpack setup](http://www.christianalfoni.com/articles/2015_04_19_The-ultimate-webpack-setup) to know more about this boilerplate.

## CSS Modules is the new thing
Read [this article](http://glenmaddern.com/articles/css-modules). This boilerplate is configured with that approach.

## Running it on Nitrous Pro
Change the `webpack.config.js` entry point: `webpack-dev-server/client?http://localhost:8080` to point to your test server, for example: `webpack-dev-server/client?http://test-103403.nitrousapp.com:3000`.  
