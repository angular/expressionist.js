var allTestFiles = [];
var TEST_REGEXP = /\.spec\.js$/;

var pathToModule = function(path) {
  return path.replace(/^\/base\//, '').replace(/\.js$/, '');
};

Object.keys(window.__karma__.files).forEach(function(file) {
  if (TEST_REGEXP.test(file)) {
    // Normalize paths to RequireJS module names.
    allTestFiles.push(pathToModule(file));
  }
});

require.config({
  // Karma serves files under /base, which is the basePath from your config file
  baseUrl: '/base',

  paths: {
    'assert': './node_modules/pipe/node_modules/assert/dist/amd/assert',
    'node_modules': './node_modules'
  },
  map: {
    '*': {
      'watchtower': 'node_modules/watchtower/dist/amd/index'
    }
  },

  // Dynamically load all test files and ES6 polyfill.
  deps: allTestFiles.concat(['node_modules/es6-shim/es6-shim']),

  // we have to kickoff jasmine, as it is asynchronous
  callback: window.__karma__.start
});
