var gulp = require('gulp');
var babel = require('gulp-babel');
var jshint = require('gulp-jshint');
var nodemon = require('gulp-nodemon');

gulp.task('build', ['build-client', 'build-server']);

gulp.task('lint-client', function () {
  return gulp.src('client/js/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default', { verbose: true}));
});

gulp.task('build-client', ['lint-client', 'move-client'], function () {
  return gulp.src('client/js/*.js')
    .pipe(babel())
    .pipe(gulp.dest('bin/client/js/'));
});

gulp.task('move-client', function () {
  return gulp.src(['client/**/*.*', '!client/js/*.js'])
    .pipe(gulp.dest('./bin/client/'));
});

gulp.task('lint-server', function () {
  return gulp.src('server/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default', { verbose: true}));
});

gulp.task('build-server', ['lint-server', 'move-server'], function () {
  return gulp.src('server/*.js')
    .pipe(gulp.dest('bin/server/'));
});

gulp.task('move-server', function () {
  return gulp.src(['server/**/*.*', 'server/**/*.js'])
    .pipe(gulp.dest('./bin/server/'));
});

gulp.task('watch', ["build"], function () {
  gulp.watch('client/**/*.*', ['build-client', 'move-client']);
  gulp.watch('server/*.*', 'server/**/*.js', ['build-server']);
  gulp.start("run");
});

gulp.task('run', ["build"], function () {
    nodemon({
        delay: 10,
        script: 'server/server.js',
        cwd: "./bin/",
        args: ["/server/config.json"],
        ext: 'html js css'
    })
    .on('restart', function () {
        console.log('restarted!');
    });
});
