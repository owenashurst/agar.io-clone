var gulp = require('gulp');
var babel = require('gulp-babel');
var jshint = require('gulp-jshint');
var nodemon = require('gulp-nodemon');
var babelify = require('babelify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');

gulp.task('build', ['build-client', 'move-client', 'build-server', 'move-server']);

gulp.task('build-client', function () {
  var b = browserify({
    entries: './client/js/app.js',
    transform: [babelify]
  });

  return b.bundle()
    .on('error', function(err) {
      console.log(err.toString());
      this.emit('end');
    })
    .pipe(source('build.js'))
    .pipe(gulp.dest('./bin/client/js/'));
});

gulp.task('move-client', function () {
  return gulp
    .src(['./client/**/*.*', '!./client/js/*.js', '!./client/js/*.json'])
    .pipe(gulp.dest('./bin/client/'));
});

gulp.task('build-server', function () {
  return gulp.src('./server/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default', { verbose: true }))
    .pipe(gulp.dest('./bin/server/'));
});

gulp.task('move-server', function () {
  return gulp
    .src(['server/**/*.*', '!server/**/*.js'])
    .pipe(gulp.dest('./bin/server/'));
});

gulp.task('watch', ["build"], function () {
  gulp.watch('client/**/*.*', ['build-client', 'move-client']);
  gulp.watch('server/*.*', ['build-server', 'move-server']);
  gulp.start("run");
});

gulp.task('run', ["build"], function () {
  nodemon({
    delay: 10,
    script: 'server/server.js',
    cwd: "./bin/",
    args: ["/server/config.yml"],
    ext: 'html js css'
  })
  .on('restart', function () {
      console.log('restarted!');
  });
});
