var gulp = require("gulp");
var babel = require("gulp-babel");

gulp.task("build", ["build-client", "move-client", "build-server"]);

gulp.task("build-client", function () {
	return gulp.src("client/js/*.js")
		.pipe(babel())
		.pipe(gulp.dest("bin/client/js/"));
});

gulp.task("move-client", function () {
	return gulp.src(["client/**/*.*", "!client/js/*.js"])
		.pipe(gulp.dest("./bin/client/"));
});

gulp.task("build-server", function () {
	return gulp.src("server/*.js")
		.pipe(babel())
		.pipe(gulp.dest("bin/server/"));
});


