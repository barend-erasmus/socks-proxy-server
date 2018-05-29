const gulp = require('gulp');
const clean = require('gulp-clean');
const runSequence = require('run-sequence');

gulp.task('clean', function () {
    return gulp.src('./dist', { read: false })
        .pipe(clean());
});

gulp.task('copy-package.json', function () {
    return gulp.src('./package.json').pipe(gulp.dest('./dist'));
});

gulp.task('build', function () {
    runSequence(
        'clean',
        'copy-package.json',
    );
});