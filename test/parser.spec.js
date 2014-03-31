import {Parser} from '../src/parser';

describe('parser', () => {
  var parser,
      context;

  beforeEach(() => {
    parser = new Parser();
    context = {};
  });

  function evaluate(text, filters){
    return parser.parse(text).eval(context, filters);
  }

  function expectEval(text) {
    return expect(() => evaluate(text));
  }

  describe('expressions', () => {
    it('should parse numerical expressions', () => {
      expect(evaluate("1")).toEqual(1);
    });

    it('should parse unary - expressions', () => {
      expect(evaluate("-1")).toEqual(-1);
    });

    it('should parse unary + expressions', () => {
      expect(evaluate("+1")).toEqual(1);
      expect(evaluate("+'1'")).toEqual(1);
      expect(evaluate("+'not a number'")).toEqual(NaN);
    });

    it('should parse unary ! expressions', () => {
      expect(evaluate("!true")).toEqual(!true);
    });

    it('should parse multiplicative expressions', () => {
      expect(evaluate("3*4/2%5")).toEqual(3*4/2%5);
      expect(evaluate("3*4~/2%5")).toEqual(Math.floor(3*4/2)%5);
    });

    it('should parse additive expressions', () => {
      expect(evaluate("3+6-2")).toEqual(3+6-2);
    });

    it('should parse relational expressions', () => {
      expect(evaluate("2<3")).toEqual(2<3);
      expect(evaluate("2>3")).toEqual(2>3);
      expect(evaluate("2<=2")).toEqual(2<=2);
      expect(evaluate("2>=2")).toEqual(2>=2);
    });

    it('should parse equality expressions', () => {
      expect(evaluate("2==3")).toEqual(2==3);
      expect(evaluate("2!=3")).toEqual(2!=3);
    });

    it('should parse logicalAND expressions', () => {
      expect(evaluate("true&&true")).toEqual(true&&true);
      expect(evaluate("true&&false")).toEqual(true&&false);
    });

    it('should parse logicalOR expressions', () => {
      expect(evaluate("true||true")).toEqual(true||true);
      expect(evaluate("true||false")).toEqual(true||false);
      expect(evaluate("false||false")).toEqual(false||false);
    });

    it('should parse ternary/conditional expressions', () => {
      var a, b, c;

      expect(evaluate("7==3+4?10:20")).toEqual(true?10:20);
      expect(evaluate("false?10:20")).toEqual(false?10:20);
      expect(evaluate("5?10:20")).toEqual(!!(5)?10:20);
      expect(evaluate("null?10:20")).toEqual(!!(null)?10:20);
      expect(evaluate("true||false?10:20")).toEqual(true||false?10:20);
      expect(evaluate("true&&false?10:20")).toEqual(true&&false?10:20);
      expect(evaluate("true?a=10:a=20")).toEqual(true?a=10:a=20);
      
      expect([context['a'], a]).toEqual([10, 10]);
      context['a'] = a = null;

      expect(evaluate("b=true?a=false?11:c=12:a=13")).toEqual(b=true?a=false?11:c=12:a=13);
      expect([context['a'], context['b'], context['c']]).toEqual([a, b, c]);

      expect([a, b, c]).toEqual([12, 12, 12]);
    });

    it('should auto convert ints to strings', () => {
      expect(evaluate("'str ' + 4")).toEqual("str 4");
      expect(evaluate("4 + ' str'")).toEqual("4 str");
      expect(evaluate("4 + 4")).toEqual(8);
      expect(evaluate("4 + 4 + ' str'")).toEqual("8 str");
      expect(evaluate("'str ' + 4 + 4")).toEqual("str 44");
    });

    it('should allow keyed access on non-maps', () => {
      context['nonmap'] = { 'hello':'hello' };

      expect(evaluate("nonmap['hello']")).toEqual('hello');
      expect(evaluate("nonmap['hello']=3")).toEqual(3);
    });
  });

  describe('error handling', () => {
    it('should throw a reasonable error for unconsumed tokens', () => {
      expectEval(")").toThrow(new Error('Parser Error: Unconsumed token ) at column 1 in [)]'));
    });

    it('should throw on missing expected token', () => {
      expectEval("a(b").toThrow(new Error('Parser Error: Missing expected ) at the end of the expression [a(b]'));
    });

    it('should throw on bad assignment', () => {
      expectEval("5=4").toThrow(new Error('Parser Error: Expression 5 is not assignable at column 2 in [5=4]'));
      expectEval("array[5=4]").toThrow(new Error('Parser Error: Expression 5 is not assignable at column 8 in [array[5=4]]'));
    });

    it('should throw on incorrect ternary operator syntax', () => {
      expectEval("true?1").toThrow(new Error('Parser Error: Conditional expression true?1 requires all 3 expressions at the end of the expression [true?1]'));
    });

    it('should throw on non-function function calls', () => {
      expectEval("4()").toThrow(new Error('4 is not a function'));
    });

    it('should fail gracefully when invoking non-function', () => {
      expect(() => {
        parser.parse('a[0]()').eval({a: [4]});
      }).toThrow(new Error('a[0] is not a function'));

      expect(() => {
        parser.parse('a[x()]()').eval({a: [4], x: function() { return 0; } });
      }).toThrow(new Error('a[x()] is not a function'));

      expect(() => {
        parser.parse('{}()').eval({});
      }).toThrow(new Error('{} is not a function'));
    });

    it('should throw on undefined functions (relaxed message)', () => {
      expectEval("notAFn()").toThrow(new Error('Undefined function notAFn'));
    });

    it('should fail gracefully when missing a function (relaxed message)', () => {
      expect(() => {
        parser.parse('doesNotExist()').eval({});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('exists(doesNotExist())').eval({exists: function() {return true;}});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('doesNotExist(exists())').eval({exists: function() {return true;}});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('doesNotExist(1)').eval({});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('doesNotExist(1, 2)').eval({});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('doesNotExist()').eval(new TestData());
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('doesNotExist(1)').eval(new TestData());
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('doesNotExist(1, 2)').eval(new TestData());
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('a.doesNotExist()').eval({a: {}});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('a.doesNotExist(1)').eval({a: {}});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('a.doesNotExist(1, 2)').eval({a: {}});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('a.doesNotExist()').eval({a: new TestData()});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('a.doesNotExist(1)').eval({a: new TestData()});
      }).toThrow(new Error('Undefined function doesNotExist'));

      expect(() => {
        parser.parse('a.doesNotExist(1, 2)').eval({a: new TestData()});
      }).toThrow(new Error('Undefined function doesNotExist'));
    });

    it('should let null be null', () => {
      context['map'] = {};

      expect(evaluate('null')).toBe(null);
      expect(evaluate('map.null')).toBe(undefined);
    });

    it('should behave gracefully with a null scope', () => {
      expect(parser.parse('null').eval(null)).toBe(null);
    });

    it('should eval binary operators with null as null', () => {
      expect(evaluate("null < 0")).toEqual(null);
      expect(evaluate("null * 3")).toEqual(null);

      // But + and - are special cases.
      expect(evaluate("null + 6")).toEqual(6);
      expect(evaluate("5 + null")).toEqual(5);
      expect(evaluate("null - 4")).toEqual(-4);
      expect(evaluate("3 - null")).toEqual(3);
      expect(evaluate("null + null")).toEqual(0);
      expect(evaluate("null - null")).toEqual(0);
    });

    it('should pass exceptions through getters', () => {
      expect(() => {
        parser.parse('boo').eval(new ScopeWithErrors());
      }).toThrow(new Error('boo to you'));
    });

    it('should pass exceptions through methods', () => {
      expect(() => {
        parser.parse('foo()').eval(new ScopeWithErrors());
      }).toThrow(new Error('foo to you'));
    });
  });

  describe('setters', () => {
    it('should set a field in a map', () => {
      context['map'] = {};
      evaluate('map["square"] = 6');
      evaluate('map.dot = 7');

      expect(context['map']['square']).toEqual(6);
      expect(context['map']['dot']).toEqual(7);
    });

    it('should set a field in a list', () => {
      context['list'] = [];
      evaluate('list[3] = 2');

      expect(context['list'].length).toEqual(4);
      expect(context['list'][3]).toEqual(2);
    });

    it('should set a field on an object', () => {
      context['obj'] = new SetterObject();
      evaluate('obj.field = 1');

      expect(context['obj'].field).toEqual(1);
    });

    it('should set a setter on an object', () => {
      context['obj'] = new SetterObject();
      evaluate('obj.setter = 2');

      expect(context['obj'].setterValue).toEqual(2);
    });

    it('should set a field in a nested map on an object', () => {
      context['obj'] = new SetterObject();
      evaluate('obj.map.mapKey = 3');

      expect(context['obj'].map['mapKey']).toEqual(3);
    });

    it('should set a field in a nested object on an object', () => {
      context['obj'] = new SetterObject();
      evaluate('obj.nested.field = 1');

      expect(context['obj'].nested.field).toEqual(1);
    });
  });

  describe('reserved words', () => {
    it('should support reserved words in member get access', () => {
      RESERVED_WORDS.forEach((reserved) => {
        expect(parser.parse(`o.${reserved}`).eval({ o: {} })).toEqual(undefined);

        var o = {};
        o[reserved] = reserved;

        expect(parser.parse(`o.${reserved}`).eval({ o: o })).toEqual(reserved);
      });
    });

    it('should support reserved words in member set access', () => {
      RESERVED_WORDS.forEach((reserved) => {
        expect(parser.parse(`o.${reserved} = 42`).eval({ o: {} })).toEqual(42);
        var map = { reserved: 0 };
        expect(parser.parse(`o.${reserved} = 42`).eval({ o: map })).toEqual(42);
        expect(map[reserved]).toEqual(42);
      });
    });

    it('should support reserved words in member calls', () => {
      RESERVED_WORDS.forEach((reserved) => {
        expect(() => {
          parser.parse(`o.${reserved}()`).eval({ o: {} });
        }).toThrow(new Error(`Undefined function ${reserved}`));

        var o = {};
        o[reserved] = function() { return reserved; };

        expect(parser.parse(`o.${reserved}()`).eval({ o: o})).toEqual(reserved);
      });
    });

    it('should support reserved words in scope get access', () => {
      RESERVED_WORDS.forEach((reserved) => {
        if (["true", "false", "null"].indexOf(reserved) != -1){
          return;
        }

        var o = {};
        o[reserved] = reserved;

        expect(parser.parse(reserved).eval({})).toEqual(undefined);
        expect(parser.parse(reserved).eval(o)).toEqual(reserved);
      });
    });

    it('should support reserved words in scope set access', () => {
      RESERVED_WORDS.forEach((reserved) => {
        if (["true", "false", "null"].indexOf(reserved) != -1) {
          return;
        }

        expect(parser.parse(`${reserved} = 42`).eval({})).toEqual(42);
        var map = { reserved: 0 };
        expect(parser.parse(`${reserved} = 42`).eval(map)).toEqual(42);
        expect(map[reserved]).toEqual(42);
      });
    });

    it('should support reserved words in scope calls', () => {
      RESERVED_WORDS.forEach((reserved) => {
        if (["true", "false", "null"].indexOf(reserved) != -1){
          return;
        }

        expect(() => {
          parser.parse(`${reserved}()`).eval({});
        }).toThrow(new Error(`Undefined function ${reserved}`));

        var o = {};
        o[reserved] = function() { return reserved; };

        expect(parser.parse(`${reserved}()`).eval(o)).toEqual(reserved);
      });
    });
  });

  describe('test cases imported from AngularJS', () => {
    //// ==== IMPORTED ITs
    it('should parse expressions', () => {
      expect(evaluate("-1")).toEqual(-1);
      expect(evaluate("1 + 2.5")).toEqual(3.5);
      expect(evaluate("1 + -2.5")).toEqual(-1.5);
      expect(evaluate("1+2*3/4")).toEqual(1+2*3/4);
      expect(evaluate("0--1+1.5")).toEqual(0- -1 + 1.5);
      expect(evaluate("-0--1++2*-3/-4")).toEqual(-0- -1+ 2*-3/-4);
      expect(evaluate("1/2*3")).toEqual(1/2*3);
    });

    it('should parse comparison', () => {
      expect(evaluate("false")).toBeFalsy();
      expect(evaluate("!true")).toBeFalsy();
      expect(evaluate("1==1")).toBeTruthy();
      expect(evaluate("1!=2")).toBeTruthy();
      expect(evaluate("1<2")).toBeTruthy();
      expect(evaluate("1<=1")).toBeTruthy();
      expect(evaluate("1>2")).toEqual(1>2);
      expect(evaluate("2>=1")).toEqual(2>=1);
      expect(evaluate("true==2<3")).toEqual(true == 2<3);
    });

    it('should parse logical', () => {
      expect(evaluate("0&&2")).toEqual((0!=0)&&(2!=0));
      expect(evaluate("0||2")).toEqual(0!=0||2!=0);
      expect(evaluate("0||1&&2")).toEqual(0!=0||1!=0&&2!=0);
    });

    it('should parse ternary', () => {
      var returnTrue = context['returnTrue'] = () => true;
      var returnFalse = context['returnFalse'] = () => false;
      var returnString = context['returnString'] = () => 'asd';
      var returnInt = context['returnInt'] = () => 123;
      var identity = context['identity'] = (x) => x;
      var B = (val) => !!val;

      // Simple.
      expect(evaluate('0?0:2')).toEqual(B(0)?0:2);
      expect(evaluate('1?0:2')).toEqual(B(1)?0:2);

      // Nested on the left.
      expect(evaluate('0?0?0:0:2')).toEqual(B(0)?B(0)?0:0:2);
      expect(evaluate('1?0?0:0:2')).toEqual(B(1)?B(0)?0:0:2);
      expect(evaluate('0?1?0:0:2')).toEqual(B(0)?B(1)?0:0:2);
      expect(evaluate('0?0?1:0:2')).toEqual(B(0)?B(0)?1:0:2);
      expect(evaluate('0?0?0:2:3')).toEqual(B(0)?B(0)?0:2:3);
      expect(evaluate('1?1?0:0:2')).toEqual(B(1)?B(1)?0:0:2);
      expect(evaluate('1?1?1:0:2')).toEqual(B(1)?B(1)?1:0:2);
      expect(evaluate('1?1?1:2:3')).toEqual(B(1)?B(1)?1:2:3);
      expect(evaluate('1?1?1:2:3')).toEqual(B(1)?B(1)?1:2:3);

      // Nested on the right.
      expect(evaluate('0?0:0?0:2')).toEqual(B(0)?0:B(0)?0:2);
      expect(evaluate('1?0:0?0:2')).toEqual(B(1)?0:B(0)?0:2);
      expect(evaluate('0?1:0?0:2')).toEqual(B(0)?1:B(0)?0:2);
      expect(evaluate('0?0:1?0:2')).toEqual(B(0)?0:B(1)?0:2);
      expect(evaluate('0?0:0?2:3')).toEqual(B(0)?0:B(0)?2:3);
      expect(evaluate('1?1:0?0:2')).toEqual(B(1)?1:B(0)?0:2);
      expect(evaluate('1?1:1?0:2')).toEqual(B(1)?1:B(1)?0:2);
      expect(evaluate('1?1:1?2:3')).toEqual(B(1)?1:B(1)?2:3);
      expect(evaluate('1?1:1?2:3')).toEqual(B(1)?1:B(1)?2:3);

      // Precedence with respect to logical operators.
      expect(evaluate('0&&1?0:1')).toEqual(B(0)&&B(1)?0:1);
      expect(evaluate('1||0?0:0')).toEqual(B(1)||B(0)?0:0);

      expect(evaluate('0?0&&1:2')).toEqual(B(0)?B(0)&&B(1):2);
      expect(evaluate('0?1&&1:2')).toEqual(B(0)?B(1)&&B(1):2);
      expect(evaluate('0?0||0:1')).toEqual(B(0)?B(0)||B(0):1);
      expect(evaluate('0?0||1:2')).toEqual(B(0)?B(0)||B(1):2);

      expect(evaluate('1?0&&1:2')).toEqual(B(1)?B(0)&&B(1):2);
      expect(evaluate('1?1&&1:2')).toEqual(B(1)?B(1)&&B(1):2);
      expect(evaluate('1?0||0:1')).toEqual(B(1)?B(0)||B(0):1);
      expect(evaluate('1?0||1:2')).toEqual(B(1)?B(0)||B(1):2);

      expect(evaluate('0?1:0&&1')).toEqual(B(0)?1:B(0)&&B(1));
      expect(evaluate('0?2:1&&1')).toEqual(B(0)?2:B(1)&&B(1));
      expect(evaluate('0?1:0||0')).toEqual(B(0)?1:B(0)||B(0));
      expect(evaluate('0?2:0||1')).toEqual(B(0)?2:B(0)||B(1));

      expect(evaluate('1?1:0&&1')).toEqual(B(1)?1:B(0)&&B(1));
      expect(evaluate('1?2:1&&1')).toEqual(B(1)?2:B(1)&&B(1));
      expect(evaluate('1?1:0||0')).toEqual(B(1)?1:B(0)||B(0));
      expect(evaluate('1?2:0||1')).toEqual(B(1)?2:B(0)||B(1));

      // Function calls.
      expect(evaluate('returnTrue() ? returnString() : returnInt()')).toEqual(
          returnTrue() ? returnString() : returnInt());
      expect(evaluate('returnFalse() ? returnString() : returnInt()')).toEqual(
          returnFalse() ? returnString() : returnInt());
      expect(evaluate('returnTrue() ? returnString() : returnInt()')).toEqual(
          returnTrue() ? returnString() : returnInt());
      expect(evaluate('identity(returnFalse() ? returnString() : returnInt())')).toEqual(
          identity(returnFalse() ? returnString() : returnInt()));
    });

    it('should parse string', () => {
      expect(evaluate("'a' + 'b c'")).toEqual("ab c");
    });


    it('should access scope', () => {
      context['a'] =  123;
      context['b'] = {c: 456};

      expect(evaluate("a")).toEqual(123);
      expect(evaluate("b.c")).toEqual(456);
      expect(evaluate("x.y.z")).toEqual(null);
    });

    it('should access classes on scope', () => {
      context['ident'] = new Ident();
      expect(evaluate('ident.id(6)')).toEqual(6);
      expect(evaluate('ident.doubleId(4,5)')).toEqual([4, 5]);
    });

    it('should resolve deeply nested paths (important for CSP mode)', () => {
      context['a'] = {b: {c: {d: {e: {f: {g: {h: {i: {j: {k: {l: {m: {n: 'nooo!'}}}}}}}}}}}}};
      expect(evaluate("a.b.c.d.e.f.g.h.i.j.k.l.m.n")).toBe('nooo!');
    });

    it('should be forgiving', () => {
      context = {a: {b: 23}};
      expect(evaluate('b')).toBeUndefined();
      expect(evaluate('a.x')).toBeUndefined();
    });

    it('should resturn null for a.b.c.d when c is null', () => {
      context = {a: {b: 23}};
      expect(evaluate('a.b.c.d')).toEqual(null);
    });

    it('should evaluate grouped expressions', () => {
      expect(evaluate("(1+2)*3")).toEqual((1+2)*3);
    });

    it('should evaluate assignments', () => {
      context = {g: 4, arr: [3,4]};

      expect(evaluate("a=12")).toEqual(12);
      expect(context["a"]).toEqual(12);

      expect(evaluate("arr[c=1]")).toEqual(4);
      expect(context["c"]).toEqual(1);

      expect(evaluate("x.y.z=123;")).toEqual(123);
      expect(context["x"]["y"]["z"]).toEqual(123);

      expect(evaluate("a=123; b=234")).toEqual(234);
      expect(context["a"]).toEqual(123);
      expect(context["b"]).toEqual(234);
    });

    // TODO: assignment to an arr[c]
    // TODO: failed assignment
    // TODO: null statements in multiple statements

    it('should evaluate function call without arguments', () => {
      context['constN'] = () => 123;
      expect(evaluate("constN()")).toEqual(123);
    });

    it('should access a protected keyword on scope', () => {
      context['const'] = 3;
      expect(evaluate('const')).toEqual(3);
    });

    it('should evaluate function call with arguments', () => {
      context["add"] =  (a,b) => {
        return a+b;
      };

      expect(evaluate("add(1,2)")).toEqual(3);
    });

    it('should evaluate function call from a return value', () => {
      context["val"] = 33;
      context["getter"] = () => { return () => { return context["val"]; };};
      expect(evaluate("getter()()")).toBe(33);
    });

    it('should evaluate methods on object', () => {
      context['obj'] = ['ABC'];
      expect(parser.parse("obj.indexOf('ABC')").eval(context)).toEqual(0);
    });

    it('should only check locals on first dereference', () => {
      context['a'] = {b: 1};
      context['this'] = context;
      var locals = {b: 2};
      var bound = parser.parse("this['a'].b").bind(context, ScopeLocals.wrapper);
      expect(bound.eval(locals)).toEqual(1);
    });

    it('should evaluate multiplication and division', () => {
      context["taxRate"] =  8;
      context["subTotal"] =  100;
      expect(evaluate("taxRate / 100 * subTotal")).toEqual(8);
      expect(evaluate("taxRate ~/ 100 * subTotal")).toEqual(0);
      expect(evaluate("subTotal * taxRate / 100")).toEqual(8);
    });

    it('should evaluate array', () => {
      expect(evaluate("[]").length).toEqual(0);
      expect(evaluate("[1, 2]").length).toEqual(2);
      expect(evaluate("[1, 2]")[0]).toEqual(1);
      expect(evaluate("[1, 2]")[1]).toEqual(2);
    });

    it('should evaluate array access', () => {
      expect(evaluate("[1][0]")).toEqual(1);
      expect(evaluate("[[1]][0][0]")).toEqual(1);
      expect(evaluate("[]")).toEqual([]);
      expect(evaluate("[].length")).toEqual(0);
      expect(evaluate("[1, 2].length")).toEqual(2);
    });

    it('should evaluate object', () => {
      expect(evaluate("{}")).toEqual({});
      expect(evaluate("{a:'b'}")).toEqual({a:"b"});
      expect(evaluate("{'a':'b'}")).toEqual({a:"b"});
      expect(evaluate("{\"a\":'b'}")).toEqual({a:"b"});
    });

    it('should evaluate object access', () => {
      expect(evaluate("{false:'WC', true:'CC'}[false]")).toEqual("WC");
    });

    it('should evaluate JSON', () => {
      expect(evaluate("[{}]")).toEqual([{}]);
      expect(evaluate("[{a:[]}, {b:1}]")).toEqual([{a:[]},{b:1}]);
    });

    it('should evaluate multiple statements', () => {
      expect(evaluate("a=1;b=3;a+b")).toEqual(4);
      expect(evaluate(";;1;;")).toEqual(1);
    });

    // skipping should evaluate object methods in correct context (this)
    // skipping should evaluate methods in correct context (this) in argument

    it('should evaluate objects on scope context', () => {
      context["a"] =  "abc";
      expect(evaluate("{a:a}")["a"]).toEqual("abc");
    });

    it('should evaluate field access on function call result', () => {
      context["a"] = () => {
        return {name:'misko'};
      };

      expect(evaluate("a().name")).toEqual("misko");
    });

    it('should evaluate field access after array access', () => {
      context["items"] =  [{}, {name:'misko'}];
      expect(evaluate('items[1].name')).toEqual("misko");
    });

    it('should evaluate array assignment', () => {
      context["items"] =  [];

      expect(evaluate('items[1] = "abc"')).toEqual("abc");
      expect(evaluate('items[1]')).toEqual("abc");
      //    Dont know how to make this work....
      //    expect(eval('books[1] = "moby"')).toEqual("moby");
      //    expect(eval('books[1]')).toEqual("moby");
    });

    it('should evaluate remainder', () => {
      expect(evaluate('1%2')).toEqual(1);
    });

    it('should evaluate sum with undefined', () => {
      expect(evaluate('1+undefined')).toEqual(1);
      expect(evaluate('undefined+1')).toEqual(1);
    });

    it('should throw exception on non-closed bracket', () => {
      expect(() => {
        evaluate('[].count(');
      }).toThrow(new Error('Unexpected end of expression: [].count('));
    });

    it('should evaluate double negation', () => {
      expect(evaluate('true')).toBeTruthy();
      expect(evaluate('!true')).toBeFalsy();
      expect(evaluate('!!true')).toBeTruthy();
      expect(evaluate('{true:"a", false:"b"}[!!true]')).toEqual('a');
    });

    it('should evaluate negation', () => {
      expect(evaluate("!false || true")).toEqual(!false || true);
      expect(evaluate("!(11 == 10)")).toEqual(!(11 == 10));
      expect(evaluate("12/6/2")).toEqual(12/6/2);
    });

    it('should evaluate exclamation mark', () => {
      expect(evaluate('suffix = "!"')).toEqual('!');
    });

    it('should evaluate minus', () => {
      expect(evaluate("{a:'-'}")).toEqual({'a': "-"});
    });

    it('should evaluate undefined', () => {
      expect(evaluate("undefined")).toBeNull();
      expect(evaluate("a=undefined")).toBeNull();
      expect(context["a"]).toBeNull();
    });

    it('should allow assignment after array dereference', () => {
      context["obj"] = [{}];
      evaluate('obj[0].name=1');
      // can not be expressed in Dart expect(scope["obj"]["name"]).toBeNull();
      expect(context["obj"][0]["name"]).toEqual(1);
    });

    it('should short-circuit AND operator', () => {
      context["run"] = () => {
        throw new Error("IT SHOULD NOT HAVE RUN");
      };

      expect(evaluate('false && run()')).toBe(false);
    });

    it('should short-circuit OR operator', () => {
      context["run"] = () => {
        throw new Error("IT SHOULD NOT HAVE RUN");
      };

      expect(evaluate('true || run()')).toBe(true);
    });


    it('should support method calls on primitive types', () => {
      context["empty"] = '';
      context["zero"] = 0;
      context["bool"] = false;

      // DOES NOT WORK. String.substring is not reflected. Or toString
      // expect(eval('empty.substring(0)')).toEqual('');
      // expect(eval('zero.toString()')).toEqual('0');
      // DOES NOT WORK.  bool.toString is not reflected
      // expect(eval('bool.toString()')).toEqual('false');
    });

    it('should support map getters', () => {
      expect(parser.parse('a').eval({a: 4})).toEqual(4);
    });

    it('should support member getters', () => {
      expect(parser.parse('str').eval(new TestData())).toEqual('testString');
    });

    it('should support returning member functions', () => {
      expect(parser.parse('method').eval(new TestData())()).toEqual('testMethod');
    });

    it('should support calling member functions', () => {
      expect(parser.parse('method()').eval(new TestData())).toEqual('testMethod');
    });

    it('should support array setters', () => {
      var data = {a: [1,3]};
      expect(parser.parse('a[1]=2').eval(data)).toEqual(2);
      expect(data['a'][1]).toEqual(2);
    });

    it('should support member field setters', () => {
      var data = new TestData();
      expect(parser.parse('str="bob"').eval(data)).toEqual('bob');
      expect(data.str).toEqual("bob");
    });

    it('should support member field getters with inheritance', () => {
      var data = new MixedTestData();
      data.str = 'dole';
      expect(parser.parse('str').eval(data)).toEqual('dole');
    });

    it('should parse functions for object indices', () => {
      expect(parser.parse('a[x()]()').eval({a: [()=>6], x: () => 0})).toEqual(6);
    });
  });

  describe('assignable', () => {
    it('should expose assignment function', () => {
      var exp = parser.parse('a');
      expect(exp.assign).not.toBe(null);

      var scope = {};
      exp.assign(scope, 123);
      expect(scope).toEqual({'a':123});
    });
  });

  describe('locals', () => {
    it('should expose local variables', () => {
      expect(parser.parse('a').bind({a: 6}, ScopeLocals.wrapper).eval({a: 1})).toEqual(1);
      expect(parser.parse('add(a,b)').bind({b: 1, add:(a, b) => { return a + b; }}, ScopeLocals.wrapper).eval({a: 2})).toEqual(3);
    });

    it('should expose traverse locals', () => {
      expect(parser.parse('a.b').bind({a: {b: 6}}, ScopeLocals.wrapper).eval({a: {b:1}})).toEqual(1);
      expect(parser.parse('a.b').bind({a: null}, ScopeLocals.wrapper).eval({a: {b:1}})).toEqual(1);
      expect(parser.parse('a.b').bind({a: {b: 5}}, ScopeLocals.wrapper).eval({a: null})).toEqual(null);
    });

    it('should expose assignment function', () => {
      var exp = parser.parse('a.b');
      expect(exp.assign).not.toBe(null);
      var scope = {};
      var locals = {a: {}};
      exp.bind(scope, ScopeLocals.wrapper).assign(123, locals);
      expect(scope).toEqual({});
      expect(locals["a"]).toEqual({b:123});
    });
  });

  describe('filters', () => {
    it('should call a filter', () => {
      expect(evaluate("'Foo'|uppercase", filters)).toEqual("FOO");
      expect(evaluate("'fOo'|uppercase|lowercase", filters)).toEqual("foo");
    });

    it('should call a filter with arguments', () => {
      expect(evaluate("1|increment:2", filters)).toEqual(3);
    });

    it('should parse filters', () => {
      expect(() => {
        evaluate("1|nonexistent");
      }).toThrow(new Error('No NgFilter: nonexistent found!'));
      
      expect(() => {
        evaluate("1|nonexistent", filters);
      }).toThrow(new Error('No NgFilter: nonexistent found!'));

      context['offset'] =  3;
      expect(evaluate("'abcd'|substring:1:offset", filters)).toEqual("bc");
      expect(evaluate("'abcd'|substring:1:3|uppercase", filters)).toEqual("BC");
    });

    it('should only use filters that are passed as an argument', () => {
      var expression = parser.parse("'World'|hello");
      
      expect(() => {
        expression.eval({}, filters);
      }).toThrow(new Error('No NgFilter: hello found!'));

      expect(expression.eval({}, newFilters)).toEqual('Hello, World!');
    });

    it('should not allow filters in a chain', () => {
      expect(() => {
        parser.parse("1;'World'|hello");
      }).toThrow(new Error('Parser Error: cannot have a filter in a chain at the end of the expression [1;\'World\'|hello]'));
      expect(() => {
        parser.parse("'World'|hello;1");
      }).toThrow(new Error('Parser Error: cannot have a filter in a chain at column 15 in [\'World\'|hello;1]'));
    });
  });
});

class TestData {
  constructor(){
    this._str = "testString";
  }

  method(){
    return "testMethod";
  }
}

//HACK: Working around tracuer issues with assert and setters.
Object.defineProperty(TestData.prototype, 'str',{
  get:function(){ return this._str; },
  set:function(val) { this._str = val; }
});

class MixedTestData extends TestData {
}

class ScopeWithErrors {
  get boo() { 
    throw new Error("boo to you");
  }

  foo() { 
    throw new Error("foo to you");
  }

  get getNoSuchMethod(){
    return null.iDontExist();
  }
}

class WithPrivateField {
  constructor(){
    this.publicField = 4;
    this._privateField = 5;
  }
}

class SetterObject {
  constructor(){
    this.map = {};
  }

  get nested() {
    return this.nest ? this.nest : (this.nest = new SetterObject());
  }
}

//HACK: Working around tracuer issues with assert and setters.
Object.defineProperty(SetterObject.prototype, 'setter', {
  set:function(value){
    this.setterValue = value;
  }
});

class Ident {
  id(x) {
    return x;
  }

  doubleId(x,y) {
    return [x,y];
  }
}

class ScopeLocals {
  static wrapper(scope, locals) {
    var context = Object.create(scope);

    for(var key in locals){
      context[key] = locals[key];
    }

    return context;
  }; 
}

var RESERVED_WORDS = [
  "assert",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "else",
  "enum",
  "extends",
  "false",
  "final",
  "finally",
  "for",
  "if",
  "in",
  "is",
  "new",
  "null",
  "rethrow",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "var",
  "void",
  "while",
  "with"
];

function filters(name){
  switch(name){
    case 'uppercase':
      return function(input){
        return input.toUpperCase();
      }
    case 'lowercase':
      return function(input){
        return input.toLowerCase();
      }
    case 'increment':
      return function(input, arg){
        return input + arg;
      }
    case 'substring':
      return function(input, start, end){
        return input.substring(start, end);
      }
  }
}

function newFilters(name){
  if(name == 'hello'){
    return function(input){
      return `Hello, ${input}!`;
    }
  }
}
