"use strict";
var __moduleName = "types";
var assert = require('assert').assert;
var ArrayOfString = function ArrayOfString() {
  assert.fail('type is not instantiable');
};
($traceurRuntime.createClass)(ArrayOfString, {}, {assert: function(obj) {
    assert(obj).is(assert.arrayOf(assert.string));
  }});
module.exports = {
  get ArrayOfString() {
    return ArrayOfString;
  },
  __esModule: true
};
