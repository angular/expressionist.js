import {WatchParser} form '../src/watch_parser';
import {Parser} from '../src/parser';

import {
  GetterCache,
  DirtyCheckingChangeDetector
} from 'watchtower/dirty_checking';

import {
  WatchGroup,
  RootWatchGroup
} from 'watchtower/watch_group';

class Logger {
  constructor() {
    this._list = [];
  }

  log(message) {
    this._list.push(message);
  }

  clear() {
    this._list.length = 0;
  }

  toArray() {
    return [].concat(this._list);
  }

  toString() {
    return `${this._list.join(";")}`;
  }
}

describe('AST Bridge', ()=>{
  var context, watchGrp, detector, parser, watchParser, logger;

  function setup(ctx={}) {
    context = ctx;
    detector = new DirtyCheckingChangeDetector(new GetterCache({}));
    watchGrp = new RootWatchGroup(detector, context);
    parser = new Parser();
    watchParser = new WatchParser(parser);
    logger = new Logger();
  }

  function watch(expr, callback) {
    var watchAst = watchParser.parse('field', []);
    watchGrp.watch(watchAst, callback);    
  }

  function detectChanges() {
    watchGrp.detectChanges();
  }

  it('should watch field', ()=>{
    setup({
      field: 'Worked!'
    });

    watch('field', (value, previous) => { logger.log([value, previous]) });
    
    expect(logger.toArray()).toEqual([]);
    detectChanges();
    expect(logger.toArray()).toEqual([['Worked!', undefined]]);
    detectChanges();
    expect(logger.toArray()).toEqual([['Worked!', undefined]]);
  });
  
  /* TODO: port the following tests into JS!

  it('should watch field path', (Logger logger, Map context, RootScope rootScope) {
    context['a'] = {'b': 'AB'};
    rootScope.watch('a.b', (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual(['AB']);
    context['a']['b'] = '123';
    rootScope.digest();
    expect(logger).toEqual(['AB', '123']);
    context['a'] = {'b': 'XYZ'};
    rootScope.digest();
    expect(logger).toEqual(['AB', '123', 'XYZ']);
  });

  it('should watch math operations', (Logger logger, Map context, RootScope rootScope) {
    context['a'] = 1;
    context['b'] = 2;
    rootScope.watch('a + b + 1', (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual([4]);
    context['a'] = 3;
    rootScope.digest();
    expect(logger).toEqual([4, 6]);
    context['b'] = 5;
    rootScope.digest();
    expect(logger).toEqual([4, 6, 9]);
  });


  it('should watch literals', (Logger logger, Map context, RootScope rootScope) {
    context['a'] = 1;
    rootScope
        ..watch('1', (value, previous) => logger(value))
        ..watch('"str"', (value, previous) => logger(value))
        ..watch('[a, 2, 3]', (value, previous) => logger(value))
        ..watch('{a:a, b:2}', (value, previous) => logger(value))
        ..digest();
    expect(logger).toEqual([1, 'str', [1, 2, 3], {'a': 1, 'b': 2}]);
    logger.clear();
    context['a'] = 3;
    rootScope.digest();
    expect(logger).toEqual([[3, 2, 3], {'a': 3, 'b': 2}]);
  });

  it('should watch nulls', (Logger logger, Map context, RootScope rootScope) {
    var r = (value, _) => logger(value);
    rootScope
        ..watch('null < 0',r)
        ..watch('null * 3', r)
        ..watch('null + 6', r)
        ..watch('5 + null', r)
        ..watch('null - 4', r)
        ..watch('3 - null', r)
        ..watch('null + null', r)
        ..watch('null - null', r)
        ..watch('null == null', r)
        ..watch('null != null', r)
        ..digest();
    expect(logger).toEqual([null, null, 6, 5, -4, 3, 0, 0, true, false]);
  });

  it('should invoke closures', (Logger logger, Map context, RootScope rootScope) {
    context['fn'] = () {
      logger('fn');
      return 1;
    };
    context['a'] = {'fn': () {
      logger('a.fn');
      return 2;
    }};
    rootScope.watch('fn()', (value, previous) => logger('=> $value'));
    rootScope.watch('a.fn()', (value, previous) => logger('-> $value'));
    rootScope.digest();
    expect(logger).toEqual(['fn', 'a.fn', '=> 1', '-> 2',
    /second loop/ 'fn', 'a.fn']);
    logger.clear();
    rootScope.digest();
    expect(logger).toEqual(['fn', 'a.fn']);
  });

  it('should perform conditionals', (Logger logger, Map context, RootScope rootScope) {
    context['a'] = 1;
    context['b'] = 2;
    context['c'] = 3;
    rootScope.watch('a?b:c', (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual([2]);
    logger.clear();
    context['a'] = 0;
    rootScope.digest();
    expect(logger).toEqual([3]);
  });


  xit('should call function', (Logger logger, Map context, RootScope rootScope) {
    context['a'] = () {
      return () { return 123; };
    };
    rootScope.watch('a()()', (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual([123]);
    logger.clear();
    rootScope.digest();
    expect(logger).toEqual([]);
  });

  it('should access bracket', (Logger logger, Map context, RootScope rootScope) {
    context['a'] = {'b': 123};
    rootScope.watch('a["b"]', (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual([123]);
    logger.clear();
    rootScope.digest();
    expect(logger).toEqual([]);
  });


  it('should prefix', (Logger logger, Map context, RootScope rootScope) {
    context['a'] = true;
    rootScope.watch('!a', (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual([false]);
    logger.clear();
    context['a'] = false;
    rootScope.digest();
    expect(logger).toEqual([true]);
  });

  it('should support filters', (Logger logger, Map context,
                                       RootScope rootScope, AstParser parser,
                                       FilterMap filters) {
    context['a'] = 123;
    context['b'] = 2;
    rootScope.watch(
        parser('a | multiply:b', filters: filters),
            (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual([246]);
    logger.clear();
    rootScope.digest();
    expect(logger).toEqual([]);
    logger.clear();
  });

  it('should support arrays in filters', (Logger logger, Map context,
                                                 RootScope rootScope,
                                                 AstParser parser,
                                                 FilterMap filters) {
    context['a'] = [1];
    rootScope.watch(
        parser('a | sort | listHead:"A" | listTail:"B"', filters: filters),
            (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual(['sort', 'listHead', 'listTail', ['A', 1, 'B']]);
    logger.clear();

    rootScope.digest();
    expect(logger).toEqual([]);
    logger.clear();

    context['a'].add(2);
    rootScope.digest();
    expect(logger).toEqual(['sort', 'listHead', 'listTail', ['A', 1, 2, 'B']]);
    logger.clear();

    // We change the order, but sort should change it to same one and it should not
    // call subsequent filters.
    context['a'] = [2, 1];
    rootScope.digest();
    expect(logger).toEqual(['sort']);
    logger.clear();
  });

  it('should support maps in filters', (Logger logger, Map context,
                                                RootScope rootScope,
                                                AstParser parser,
                                                FilterMap filters) {
    context['a'] = {'foo': 'bar'};
    rootScope.watch(
        parser('a | identity | keys', filters: filters),
        (value, previous) => logger(value));
    rootScope.digest();
    expect(logger).toEqual(['identity', 'keys', ['foo']]);
    logger.clear();

    rootScope.digest();
    expect(logger).toEqual([]);
    logger.clear();

    context['a']['bar'] = 'baz';
    rootScope.digest();
    expect(logger).toEqual(['identity', 'keys', ['foo', 'bar']]);
    logger.clear();
  });
*/
});
