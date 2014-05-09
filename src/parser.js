// TODO(vojta): use only di-annotations
import {Inject} from 'di';

import {Lexer,Token} from './lexer';
import {Expression,ArrayOfExpression,Chain,Filter,Assign,
        Conditional, AccessScope, AccessMember, AccessKeyed, 
        CallScope, CallFunction, CallMember, PrefixNot,
        Binary, LiteralPrimitive, LiteralArray, LiteralObject, LiteralString} from './ast';

var EOF = new Token(-1, null);

@Inject
export class Parser {
  constructor(){
    this.cache = {};
    this.lexer = new Lexer();
  }

  parse(input:string):Expression {
    input = input || '';

    return this.cache[input] 
      || (this.cache[input] = new ParserImplementation(this.lexer, input).parseChain());
  }
}

export class ParserImplementation {
  constructor(lexer:Lexer, input:string) {
    this.index = 0;
    this.input = input;
    this.tokens = lexer.lex(input);
  }

  get peek() {
    return (this.index < this.tokens.length) ? this.tokens[this.index] : EOF;
  }

  parseChain():Expression {
    var isChain = false,
        expressions = [];

    while (this.optional(';')) {
      isChain = true;
    }

    while (this.index < this.tokens.length) {
      if (this.peek.text == ')' || this.peek.text == '}' || this.peek.text == ']') {
        this.error(`Unconsumed token ${this.peek.text}`);
      }

      var expr = this.parseFilter();
      expressions.push(expr);

      while (this.optional(';')) {
        isChain = true;
      }

      if (isChain && expr instanceof Filter) {
        this.error('cannot have a filter in a chain');
      }
    }

    return (expressions.length == 1) ? expressions[0] : new Chain(expressions);
  }

  parseFilter():Expression {
    var result = this.parseExpression();

    while (this.optional('|')) {
      var name = this.peek.text, // TODO(kasperl): Restrict to identifier?
          args = [];  

      this.advance();

      while (this.optional(':')) {
        // TODO(kasperl): Is this really supposed to be expressions?
        args.push(this.parseExpression());
      }

      result = new Filter(result, name, args, [result].concat(args));
    }

    return result;
  }

  parseExpression():Expression {
    var start = this.peek.index,
        result = this.parseConditional();

    while (this.peek.text == '=') {
      if (!result.isAssignable) {
        var end = (this.index < this.tokens.length) ? this.peek.index : this.input.length;
        var expression = this.input.substring(start, end);

        this.error(`Expression ${expression} is not assignable`);
      }

      this.expect('=');
      result = new Assign(result, this.parseConditional());
    }

    return result;
  }

  parseConditional():Expression {
    var start = this.peek.index,
        result = this.parseLogicalOr();

    if (this.optional('?')) {
      var yes = this.parseExpression();

      if (!this.optional(':')) {
        var end = (this.index < this.tokens.length) ? this.peek.index : this.input.length;
        var expression = this.input.substring(start, end);

        this.error(`Conditional expression ${expression} requires all 3 expressions`);
      }

      var no = this.parseExpression();
      result = new Conditional(result, yes, no);
    }

    return result;
  }

  parseLogicalOr():Expression {
    var result = this.parseLogicalAnd();

    while (this.optional('||')) {
      result = new Binary('||', result, this.parseLogicalAnd());
    }

    return result;
  }

  parseLogicalAnd():Expression {
    var result = this.parseEquality();

    while (this.optional('&&')) {
      result = new Binary('&&', result, this.parseEquality());
    }

    return result;
  }

  parseEquality():Expression {
    var result = this.parseRelational();

    while (true) {
      if (this.optional('==')) {
        result = new Binary('==', result, this.parseRelational());
      } else if (this.optional('!=')) {
        result = new Binary('!=', result, this.parseRelational());
      } else {
        return result;
      }
    }
  }

  parseRelational():Expression {
    var result = this.parseAdditive();

    while (true) {
      if (this.optional('<')) {
        result = new Binary('<', result, this.parseAdditive());
      } else if (this.optional('>')) {
        result = new Binary('>', result, this.parseAdditive());
      } else if (this.optional('<=')) {
        result = new Binary('<=', result, this.parseAdditive());
      } else if (this.optional('>=')) {
        result = new Binary('>=', result, this.parseAdditive());
      } else {
        return result;
      }
    }
  }

  parseAdditive():Expression {
    var result = this.parseMultiplicative();

    while (true) {
      if (this.optional('+')) {
        result = new Binary('+', result, this.parseMultiplicative());
      } else if (this.optional('-')) {
        result = new Binary('-', result, this.parseMultiplicative());
      } else {
        return result;
      }
    }
  }

  parseMultiplicative():Expression {
    var result = this.parsePrefix();

    while (true) {
      if (this.optional('*')) {
        result = new Binary('*', result, this.parsePrefix());
      } else if (this.optional('%')) {
        result = new Binary('%', result, this.parsePrefix());
      } else if (this.optional('/')) {
        result = new Binary('/', result, this.parsePrefix());
      } else if (this.optional('~/')) {
        result = new Binary('~/', result, this.parsePrefix());
      } else {
        return result;
      }
    }
  }

  parsePrefix():Expression {
    if (this.optional('+')) { 
      return this.parsePrefix(); // TODO(kasperl): This is different than the original parser.
    } else if (this.optional('-')) {
      return new Binary('-', new LiteralPrimitive(0), this.parsePrefix());
    } else if (this.optional('!')) {
      return new PrefixNot('!', this.parsePrefix());
    } else {
      return this.parseAccessOrCallMember();
    }
  }

  parseAccessOrCallMember():Expression {
    var result = this.parsePrimary();

    while (true) {
      if (this.optional('.')) {
        var name = this.peek.text; // TODO(kasperl): Check that this is an identifier. Are keywords okay?
        
        this.advance();

        if (this.optional('(')) {
          var args = this.parseExpressionList(')');
          this.expect(')');
          result = new CallMember(result, name, args);
        } else {
          result = new AccessMember(result, name);
        }
      } else if (this.optional('[')) {
        var key = this.parseExpression();
        this.expect(']');
        result = new AccessKeyed(result, key);
      } else if (this.optional('(')) {
        var args = this.parseExpressionList(')');
        this.expect(')');
        result = new CallFunction(result, args);
      } else {
        return result;
      }
    }
  }

  parsePrimary():Expression {
    if (this.optional('(')) {
      var result = this.parseExpression();
      this.expect(')');
      return result;
    } else if (this.optional('null') || this.optional('undefined')) {
      return new LiteralPrimitive(null);
    } else if (this.optional('true')) {
      return new LiteralPrimitive(true);
    } else if (this.optional('false')) {
      return new LiteralPrimitive(false);
    } else if (this.optional('[')) {
      var elements = this.parseExpressionList(']');
      this.expect(']');
      return new LiteralArray(elements);
    } else if (this.peek.text == '{') {
      return this.parseObject();
    } else if (this.peek.key != null) {
      return this.parseAccessOrCallScope();
    } else if (this.peek.value != null) {
      var value = this.peek.value;
      this.advance();
      return isNaN(value) ? new LiteralString(value) : new LiteralPrimitive(value);
    } else if (this.index >= this.tokens.length) {
      throw new Error(`Unexpected end of expression: ${this.input}`);
    } else {
      this.error(`Unexpected token ${this.peek.text}`);
    }
  }

  parseAccessOrCallScope():Expression  {
    var name = this.peek.key;

    this.advance();

    if (!this.optional('(')) {
      return new AccessScope(name);
    }

    var args = this.parseExpressionList(')');
    this.expect(')');
    return new CallScope(name, args);
  }

  parseObject():Expression {
    var keys = [], 
        values = [];

    this.expect('{');

    if (this.peek.text != '}') {
      do {
        // TODO(kasperl): Stricter checking. Only allow identifiers
        // and strings as keys. Maybe also keywords?
        var value = this.peek.value;
        keys.push(typeof value == 'string' ? value : this.peek.text);

        this.advance();
        this.expect(':');

        values.push(this.parseExpression());
      } while (this.optional(','));
    }

    this.expect('}');

    return new LiteralObject(keys, values);
  }

  parseExpressionList(terminator:string):ArrayOfExpression {
    var result = [];

    if (this.peek.text != terminator) {
      do {
        result.push(this.parseExpression());
       } while (this.optional(','));
    }

    return result;
  }

  optional(text:string):boolean {
    if (this.peek.text == text) {
      this.advance();
      return true;
    }

    return false;
  }

  expect(text:string) {
    if (this.peek.text == text) {
      this.advance();
    } else {
      this.error(`Missing expected ${text}`);
    }
  }

  advance(){
    this.index++;
  }

  error(message:string) {
    var location = (this.index < this.tokens.length)
        ? `at column ${this.tokens[this.index].index + 1} in`
        : `at the end of the expression`;

    throw new Error(`Parser Error: ${message} ${location} [${this.input}]`);
  }
}
