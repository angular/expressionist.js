import {assert} from 'rtts-assert';

export class ArrayOfString {
  static assert(obj) {
    assert(obj).is(assert.arrayOf(assert.string));
  }

  constructor() {
    assert.fail('type is not instantiable');
  }
}