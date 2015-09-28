# webpack-express-boilerplate
A boilerplate for running a Webpack workflow in Node express

Please read the following article: [The ultimate Webpack setup](http://www.christianalfoni.com/articles/2015_04_19_The-ultimate-webpack-setup) to know more about this boilerplate.

## Major update to project
Inspired by [this project](https://github.com/vesparny/react-kickstart) and the evolving of [react-transform](https://github.com/gaearon/react-transform-boilerplate) and [CSS Modules]((http://glenmaddern.com/articles/css-modules)), this project has gotten a major upgrade.

## Overview

### React by default
The project runs with React by default and hot replacement of changes to the modules. Currently it is on 0.14 RC.

### CSS Modules
CSS files loaded into components are locally scoped and you can point to class names with javascript. You can also compose classes together, also from other files. These are also hot loaded.

### Prod vs Dev
There is one main *server.js* file which runs the development server if in DEV mode. In production it will skip the development setup. The two folders *server* and *devServer* is where requests are handled. *devServer* is used by frontend to simulate and work on APIs not currently available.

### Babel and Linting
Both Node server and frontend code runs with Babel. And all of it is linted. With atom you install the `linter` package, then `linter-eslint` and `linter-jscs`. You are covered. Also run `npm run eslint` or `npm run jscs` to verify all files. I would recommend installing `language-babel` package too for syntax highlighting

### Beautify
With a beautify package installed in your editor it will also do that
