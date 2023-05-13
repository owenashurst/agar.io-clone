/* jshint esversion: 8 */ 

const gulp = require('gulp');
const babel = require('gulp-babel');
const eslint = require('gulp-eslint');
const nodemon = require('gulp-nodemon');
const uglify = require('gulp-uglify');
const util = require('gulp-util');
const mocha = require('gulp-mocha');
const todo = require('gulp-todo');
const webpack = require('webpack-stream');

gulp.task('lint', () => {
  return gulp.src(['**/*.js', '!node_modules/**/*.js', '!bin/**/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
});

gulp.task('test', gulp.series('lint', () => {
  return gulp.src(['test/**/*.js']).pipe(mocha());
}));

gulp.task('move-client', () => {
  return gulp.src(['src/client/**/*.*', '!client/js/*.js'])
    .pipe(gulp.dest('./bin/client/'));
});

gulp.task('build-client', gulp.parallel('lint', 'move-client', () => {
  return gulp.src(['src/client/js/app.js'])
    .pipe(uglify())
    .pipe(webpack(require('./webpack.config.js')))
    .pipe(babel({
      presets: [
        ['@babel/preset-env', { 'modules': false }]
      ]
    }))
    .pipe(gulp.dest('bin/client/js/'));
}));

gulp.task('build-server', gulp.series('lint', () => {
  return gulp.src(['src/server/**/*.*', 'src/server/**/*.js'])
    .pipe(babel())
    .pipe(gulp.dest('bin/server/'));
}));

gulp.task('build', gulp.parallel('build-client', 'build-server', 'test'));

gulp.task('watch', gulp.series('build', () => {
  gulp.watch(['src/client/**/*.*'], ['build-client', 'move-client']);
  gulp.watch(['src/server/*.*', 'src/server/**/*.js'], ['build-server']);
  gulp.start('run-only');
}));

gulp.task('todo', gulp.series('lint', () => {
  return gulp.src('src/**/*.js')
    .pipe(todo())
    .pipe(gulp.dest('./'));
}));

gulp.task('run', gulp.series('build', () => {
    nodemon({
        delay: 10,
        script: './server/server.js',
        cwd: "./bin/",
        ext: 'html,js,css'
    })
    .on('restart', function () {
        util.log('server restarted!');
    });
}));

gulp.task('run-only', () => {
    nodemon({
        delay: 10,
        script: './server/server.js',
        cwd: "./bin/",
        ext: 'html js css'
    })
    .on('restart', function () {
        util.log('server restarted!');
    });
});

gulp.task('default', gulp.series('run'));
