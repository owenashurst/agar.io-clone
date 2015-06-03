var gulp = require('gulp')
  , jshint = require('gulp-jshint')
  , nodemon = require('./index')
  , path = require('path')

// gulp.task('test', function () {
//   gulp.src('./test/*-test.js')
//     .pipe(jshint({ asi: true, laxcomma: true }))
//     .pipe(mocha({ ui: 'bdd' }))
// })

gulp.task('lint', function () {
  gulp.src('./*/**.js')
    .pipe(jshint())
})

gulp.task('cssmin', function () { /* void */ })

gulp.task('afterstart', function () {
  console.log('proc has finished restarting!')
})

gulp.task('test', ['lint'], function () {
  nodemon({
      script: './test/server.js'
    , verbose: true
    , env: {
        'NODE_ENV': 'development'
      }
    , watch: './'
    , ext: 'js coffee'
    // , tasks: ['lint']
    // , tasks: function (files) {
    //     var tasks = []
    //     files.forEach(function (file) {
    //       if (path.extname(file) === '.js' && !~tasks.indexOf('lint')) tasks.push('lint')
    //       if (path.extname(file) === '.css' && !~tasks.indexOf('cssmin')) tasks.push('cssmin')
    //     })
    //     return tasks
    //   }
    // , nodeArgs: ['--debug']
    })
    .on('restart', 'cssmin')
})
