var gulp = require('gulp');
var babel = require('gulp-babel');
var jshint = require('gulp-jshint');
var nodemon = require('gulp-nodemon');
var uglify = require('gulp-uglify');
var util = require('gulp-util');
var mocha = require('gulp-mocha');
var todo = require('gulp-todo');
var webpack = require('webpack-stream');
var request = require('sync-request');
var fs = require('fs');


gulp.task('build', ['build-client', 'build-server', 'test', 'todo']);

gulp.task('test', ['lint'], function () {
    gulp.src(['test/**/*.js'])
        .pipe(mocha());
});

gulp.task('lint', function () {
  return gulp.src(['**/*.js', '!node_modules/**/*.js', '!bin/**/*.js'])
    .pipe(jshint({
          esnext: true
      }))
    .pipe(jshint.reporter('default', { verbose: true}))
    .pipe(jshint.reporter('fail'));
});

gulp.task('build-client', ['lint', 'move-client'], function () {
  return gulp.src(['src/client/js/app.js'])
    .pipe(uglify())
    .pipe(webpack(require('./webpack.config.js')))
    .pipe(babel())
    .pipe(gulp.dest('bin/client/js/'));
});

gulp.task('move-client', function () {
  return gulp.src(['src/client/**/*.*', '!client/js/*.js'])
    .pipe(gulp.dest('./bin/client/'));
});


gulp.task('build-server', ['lint'], function () {
  return gulp.src(['src/server/**/*.*', 'src/server/**/*.js'])
    .pipe(babel())
    .pipe(gulp.dest('bin/server/'));
});

gulp.task('watch', ['build'], function () {
  gulp.watch(['src/client/**/*.*'], ['build-client', 'move-client']);
  gulp.watch(['src/server/*.*', 'src/server/**/*.js'], ['build-server']);
  gulp.start('run-only');
});

gulp.task('todo', ['lint'], function() {
  gulp.src('src/**/*.js')
      .pipe(todo())
      .pipe(gulp.dest('./'));
});

gulp.task('run', ['build'], function () {
    nodemon({
        delay: 10,
        script: './server/server.js',
        cwd: "./bin/",
        args: ["config.json"],
        ext: 'html js css'
    })
    .on('restart', function () {
        util.log('server restarted!');
    });
});

gulp.task('run-only', function () {
    nodemon({
        delay: 10,
        script: './server/server.js',
        cwd: "./bin/",
        args: ["config.json"],
        ext: 'html js css'
    })
    .on('restart', function () {
        util.log('server restarted!');
    });
});

gulp.task('contributors', function(){
    var project = JSON.parse(fs.readFileSync('package.json').toString());
    var repo_pattern = /https:\/\/github.com\/(.+)\.git/i;
    var parsed_repo = project.repository.url.match(repo_pattern);
    var repo_endpoint = parsed_repo&&parsed_repo[1];

    var contributorsResponse = request('GET',
                        'https://api.github.com/repos/' + repo_endpoint + '/stats/contributors',
                            {
                            'headers': {
                                'user-agent': 'auto-contributors-grabber-' + Date.now()
                                }
                            });
    var contributors = JSON.parse(contributorsResponse.getBody().toString());
    var contributorsList = contributors.reduce(function(result, current){
        console.log('Adding ' + current.author.login + '...');
        var userResponse = request('GET', current.author.url, {
                                'headers': {
                                    'user-agent': 'auto-contributors-grabber-' + Date.now()
                                }
                            });
        var user = JSON.parse(userResponse.getBody().toString());
        return result.concat(user.name + '<' + (user.email !== null)?user.email:((user.login !== null)?user.login:'') + '>' + '(' + user.html_url + ')');
    }, []);

    project.contributors = contributorsList;

    fs.writeFile('package.json', JSON.stringify(project), function(err){
        if (err) console.log('ERROR!!!', err);
        console.log('DONE!');
    });
});

gulp.task('default', ['run']);
