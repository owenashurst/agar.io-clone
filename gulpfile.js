var gulp = require('gulp');
var babel = require('gulp-babel');
var jshint = require('gulp-jshint');
var nodemon = require('gulp-nodemon');
var babelify = require('babelify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var path = require('path');

gulp.task('build', ['build-client', 'move-client', 'build-server', 'move-server']);

gulp.task('build-client', ['move-client'], function () {
    var outputDir = path.join(__dirname, 'bin/client/js/');
    var b = browserify({
        basedir: __dirname,
        entries: 'client/js/app.js',
        transform: [babelify]
    });

    b.bundle()
        .on("error", function (err) {
            console.log(err.toString());
            this.emit("end");
        })
    .pipe(source('build.js'))
    .pipe(gulp.dest(outputDir));
});

gulp.task('move-client', function () {
    var outputDir = path.join(__dirname, 'bin/client/');
    return gulp.src(['client/**/*.*', '!client/js/*.js', '!client/js/*.json'])
		.pipe(gulp.dest(outputDir));
});

gulp.task('build-server', ['move-server'], function () {
    var inputDir = path.join(__dirname, 'server/');
    var outputDir = path.join(__dirname, 'bin/server/');
    return gulp.src(inputDir + '*.js')
		.pipe(jshint())
		.pipe(jshint.reporter('default', { verbose: true }))
		.pipe(gulp.dest(outputDir));
});

gulp.task('move-server', function () {
    var outputDir = path.join(__dirname, 'bin/server/');
    return gulp.src(['server/**/*.*', '!server/**/*.js'])
		.pipe(gulp.dest(outputDir));
});

gulp.task('watch', function () {
    gulp.watch('client/**/*.*', ['build-client']);
    gulp.watch('server/*.*', ['build-server']);
    gulp.start('run');
});

gulp.task('run', ['build'], function () {
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
