var gulp = require('gulp');
var pipe = require('pipe/gulp');
var connect = require('gulp-connect');


var path = {
  src: './src/**/*.js',
};


// TRANSPILE ES6
gulp.task('build_source_amd', function() {
  gulp.src(path.src)
      .pipe(pipe.traceur())
      .pipe(gulp.dest('dist/amd'));
});

gulp.task('build_source_cjs', function() {
  gulp.src(path.src)
      .pipe(pipe.traceur({modules: 'commonjs'}))
      .pipe(gulp.dest('dist/cjs'));
});

gulp.task('build_source_es6', function() {
  gulp.src(path.src)
      .pipe(traceur(pipe.traceur({outputLanguage: 'es6'})))
      .pipe(gulp.dest('dist/es6'));
});

gulp.task('build', ['build_source_cjs', 'build_source_amd', 'build_source_es6']);


// WATCH FILES FOR CHANGES
gulp.task('watch', function() {
  gulp.watch(path.src, ['build']);
});


// WEB SERVER
gulp.task('serve', connect.server({
  root: __dirname,
  port: 8000,
  open: {
    browser: 'Google Chrome'
  }
}));
