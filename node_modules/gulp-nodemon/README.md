gulp-nodemon
===========

it's gulp + nodemon + convenience

## Usage

Gulp-nodemon looks almost exactly like regular nodemon, but it's made for use with gulp tasks.

### **nodemon([options])**

You can pass an object to gulp-nodemon with options [like like you would in nodemon config](https://github.com/remy/nodemon#config-files).

Example below will start `server.js` in `development` mode and watch for changes, as well as watch all `.html` and `.js` files in the directory.
```javascript
gulp.task('start', function () {
  nodemon({
    script: 'server.js'
  , ext: 'js html'
  , env: { 'NODE_ENV': 'development' }
  })
})
```

## Synchronous Build Tasks

*NOTE: This feature requires Node v0.12 because of `child_process.spawnSync`.*

Nodemon is powerful but lacks the ability to compile/cleanup code prior to restarting the application... until now! Most build systems can never be complete without compilation, and now it works harmoniously with your nodemon loop.

### **{ tasks: [Array || Function(changedFiles)] }**

If you want to lint your code when you make changes that's easy to do with a simple event. But what if you need to wait while your project re-builds before you start it up again? This isn't possible with vanilla nodemon, and can be tedious to implement yourself, but it's easy with gulp-nodemon:
```javascript
nodemon({
  script: 'index.js'
, tasks: ['browserify']
})
```

What if you want to decouple your build processes by language? Or even by file? Easy, just set the `tasks` option to a function. Gulp-nodemon will pass you the list of changed files and it'll let you return a list of tasks you want run.
```javascript
nodemon({
  script: './index.js'
, ext: 'js css'
, tasks: function (changedFiles) {
    var tasks = []
    changedFiles.forEach(function (file) {
      if (path.extname(file) === '.js' && !~tasks.indexOf('lint')) tasks.push('lint')
      if (path.extname(file) === '.css' && !~tasks.indexOf('cssmin')) tasks.push('cssmin')
    })
    return tasks
  }
})
```

## Events

gulp-nodemon returns a stream just like any other NodeJS stream, **except for the `on` method**, which conveniently accepts gulp task names in addition to the typical function.

### **.on([event], [Array || Function])**

1. `[event]` is an event name as a string. See [nodemon events](https://github.com/remy/nodemon/blob/master/doc/events.md).
2. `[tasks]` An array of gulp task names or a function to execute.

## Example

The following example will run your code with nodemon, lint it when you make changes, and log a message when nodemon runs it again.

```javascript
// Gulpfile.js
var gulp = require('gulp')
  , nodemon = require('gulp-nodemon')
  , jshint = require('gulp-jshint')

gulp.task('lint', function () {
  gulp.src('./**/*.js')
    .pipe(jshint())
})

gulp.task('develop', function () {
  nodemon({ script: 'server.js'
          , ext: 'html js'
          , ignore: ['ignored.js']
          , tasks: ['lint'] })
    .on('restart', function () {
      console.log('restarted!')
    })
})
```
