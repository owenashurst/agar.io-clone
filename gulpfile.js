var gulp = require("gulp");
var babel = require("gulp-babel");

gulp.task("build-client", function () {
	gulp.src("client/js/*.js")
		.pipe(babel())
		.pipe(gulp.dest("bin/client/js/"));
});

gulp.task("move-client", function () {
	gulp.src(["client/**/*.*", "!client/js/*.js"])
		.pipe(gulp.dest("./bin/client/"));
});