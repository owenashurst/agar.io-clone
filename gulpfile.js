var gulp = require('gulp');
var babel = require('gulp-babel');
var jshint = require('gulp-jshint');
var nodemon = require('gulp-nodemon');

gulp.task('build', ['build-client', 'build-server']);

gulp.task('build-client', ['move-client'], function () {
	return gulp.src('client/js/*.js')
		.pipe(jshint())
		.pipe(jshint.reporter('default', { verbose: true}))
		.pipe(babel())
		.pipe(gulp.dest('bin/client/js/'));
});

gulp.task('move-client', function () {
	return gulp.src(['client/**/*.*', '!client/js/*.js'])
		.pipe(gulp.dest('./bin/client/'));
});

gulp.task('build-server', ['move-server'], function () {
	return gulp.src('server/*.js')
		.pipe(jshint())
		.pipe(jshint.reporter('default', { verbose: true }))
		.pipe(gulp.dest('bin/server/'));
});

gulp.task('move-server', function () {
	return gulp.src(['server/**/*.*', '!server/**/*.js'])
		.pipe(gulp.dest('./bin/server/'));
});

gulp.task('watch', ["build"], function () {
	gulp.watch('client/**/*.*', ['build-client', 'move-client']);
	gulp.watch('server/*.*', ['build-server']);
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
