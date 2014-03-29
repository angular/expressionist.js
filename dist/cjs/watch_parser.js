"use strict";
var __moduleName = "watch_parser";
var assert = require("assert").assert;
var $__4 = require('watchtower'),
    AST = $__4.AST,
    ContextReferenceAST = $__4.ContextReferenceAST,
    CollectionAST = $__4.CollectionAST,
    MethodAST = $__4.MethodAST,
    FieldReadAST = $__4.FieldReadAST,
    PureFunctionAST = $__4.PureFunctionAST,
    ConstantAST = $__4.ConstantAST;
var CollectionChangeRecord = require('watchtower').CollectionChangeRecord;
var Parser = require('./parser').Parser;
var $__4 = require('./ast'),
    Expression = $__4.Expression,
    ArrayOfExpression = $__4.ArrayOfExpression,
    Chain = $__4.Chain,
    Filter = $__4.Filter,
    Assign = $__4.Assign,
    Conditional = $__4.Conditional,
    AccessScope = $__4.AccessScope,
    AccessMember = $__4.AccessMember,
    AccessKeyed = $__4.AccessKeyed,
    CallScope = $__4.CallScope,
    CallFunction = $__4.CallFunction,
    CallMember = $__4.CallMember,
    PrefixNot = $__4.PrefixNot,
    Binary = $__4.Binary,
    LiteralPrimitive = $__4.LiteralPrimitive,
    LiteralArray = $__4.LiteralArray,
    LiteralObject = $__4.LiteralObject,
    LiteralString = $__4.LiteralString,
    Literal = $__4.Literal;
var scopeContextRef = new ContextReferenceAST();
var WatchParser = function WatchParser(parser) {
  assert.argumentTypes(parser, Parser);
  this._parser = parser;
  this._id = 0;
  this._visitor = new WatchVisitor();
};
($traceurRuntime.createClass)(WatchParser, {parse: function(exp, filters) {
    var collection = arguments[2] !== (void 0) ? arguments[2] : false;
    var context = arguments[3] !== (void 0) ? arguments[3] : null;
    assert.argumentTypes(exp, $traceurRuntime.type.string, filters, $traceurRuntime.type.any, collection, $traceurRuntime.type.any, context, $traceurRuntime.type.any);
    var contextRef = this._visitor.contextRef,
        ast;
    try {
      this._visitor.filters = filters;
      if (context != null) {
        this._visitor.contextRef = new ConstantAST(context, ("#" + this._id++));
      }
      ast = this._parser.parse(exp);
      return collection ? this._visitor.visitCollection(ast) : this._visitor.visit(ast);
    } finally {
      this._visitor.contextRef = contextRef;
      this._visitor.filters = null;
    }
  }}, {});
WatchParser.parameters = [[Parser]];
WatchParser.prototype.parse.parameters = [[$traceurRuntime.type.string], [], [], []];
var WatchVisitor = function WatchVisitor() {
  this.contextRef = scopeContextRef;
};
($traceurRuntime.createClass)(WatchVisitor, {
  visit: function(exp) {
    assert.argumentTypes(exp, Expression);
    exp.accept(this);
    assert(this.ast != null);
    try {
      return assert.returnType((this.ast), AST);
    } finally {
      this.ast = null;
    }
  },
  visitCollection: function(exp) {
    assert.argumentTypes(exp, Expression);
    return assert.returnType((new CollectionAST(this.visit(exp))), AST);
  },
  visitCallScope: function(exp) {
    assert.argumentTypes(exp, CallScope);
    this.ast = new MethodAST(this.contextRef, exp.name, this._toAst(exp.args));
  },
  visitCallMember: function(exp) {
    assert.argumentTypes(exp, CallMember);
    this.ast = new MethodAST(this.visit(exp.object), exp.name, this._toAst(exp.args));
  },
  visitAccessScope: function(exp) {
    assert.argumentTypes(exp, AccessScope);
    this.ast = new FieldReadAST(this.contextRef, exp.name);
  },
  visitAccessMember: function(exp) {
    assert.argumentTypes(exp, AccessMember);
    this.ast = new FieldReadAST(this.visit(exp.object), exp.name);
  },
  visitBinary: function(exp) {
    assert.argumentTypes(exp, Binary);
    this.ast = new PureFunctionAST(exp.operation, operationToFunction(exp.operation), [this.visit(exp.left), this.visit(exp.right)]);
  },
  visitPrefix: function(exp) {
    assert.argumentTypes(exp, PrefixNot);
    this.ast = new PureFunctionAST(exp.operation, operationToFunction(exp.operation), [this.visit(exp.expression)]);
  },
  visitConditional: function(exp) {
    assert.argumentTypes(exp, Conditional);
    this.ast = new PureFunctionAST('?:', operation_ternary, [this.visit(exp.condition), this.visit(exp.yes), this.visit(exp.no)]);
  },
  visitAccessKeyed: function(exp) {
    assert.argumentTypes(exp, AccessKeyed);
    this.ast = new PureFunctionAST('[]', operation_bracket, [this.visit(exp.object), this.visit(exp.key)]);
  },
  visitLiteralPrimitive: function(exp) {
    assert.argumentTypes(exp, LiteralPrimitive);
    this.ast = new ConstantAST(exp.value);
  },
  visitLiteralString: function(exp) {
    assert.argumentTypes(exp, LiteralString);
    this.ast = new ConstantAST(exp.value);
  },
  visitLiteralArray: function(exp) {
    assert.argumentTypes(exp, LiteralArray);
    var items = this._toAst(exp.elements);
    this.ast = new PureFunctionAST(("[" + items.join(', ') + "]"), arrayFn, items);
  },
  visitLiteralObject: function(exp) {
    assert.argumentTypes(exp, LiteralObject);
    var keys = exp.keys;
    var values = this._toAst(exp.values),
        kv = [],
        i,
        length;
    assert(keys.length == values.length);
    for (i = 0, length = keys.length; i < length; i++) {
      kv.push((keys[i] + ": " + values[i]));
    }
    this.ast = new PureFunctionAST(("{" + kv.join(', ') + "}"), mapFn(keys), values);
  },
  visitFilter: function(exp) {
    var $__5;
    var filterFunction = this.filters(exp.name);
    var args = [this.visitCollection(exp.expression)];
    ($__5 = args).push.apply($__5, $traceurRuntime.toObject(this._toAst(exp.args).map((function(ast) {
      return new CollectionAST(ast);
    }))));
    this.ast = new PureFunctionAST(("|" + exp.name), filterWrapper(filterFunction, args.length), args);
  },
  visitCallFunction: function(exp) {
    assert.argumentTypes(exp, CallFunction);
    this._notSupported("function's returning functions");
  },
  visitAssign: function(exp) {
    assert.argumentTypes(exp, Assign);
    this._notSupported('assignement');
  },
  visitLiteral: function(exp) {
    assert.argumentTypes(exp, Literal);
    this._notSupported('literal');
  },
  visitExpression: function(exp) {
    assert.argumentTypes(exp, Expression);
    this._notSupported('?');
  },
  visitChain: function(exp) {
    assert.argumentTypes(exp, Chain);
    this._notSupported(';');
  },
  _notSupported: function(name) {
    assert.argumentTypes(name, name);
    throw new Error(("Can not watch expression containing '" + name + "'."));
  },
  _toAst: function(expressions) {
    var $__0 = this;
    return expressions.map((function(exp) {
      return $__0.visit(exp);
    }));
  }
}, {});
WatchVisitor.prototype.visit.parameters = [[Expression]];
WatchVisitor.prototype.visitCollection.parameters = [[Expression]];
WatchVisitor.prototype.visitCallScope.parameters = [[CallScope]];
WatchVisitor.prototype.visitCallMember.parameters = [[CallMember]];
WatchVisitor.prototype.visitAccessScope.parameters = [[AccessScope]];
WatchVisitor.prototype.visitAccessMember.parameters = [[AccessMember]];
WatchVisitor.prototype.visitBinary.parameters = [[Binary]];
WatchVisitor.prototype.visitPrefix.parameters = [[PrefixNot]];
WatchVisitor.prototype.visitConditional.parameters = [[Conditional]];
WatchVisitor.prototype.visitAccessKeyed.parameters = [[AccessKeyed]];
WatchVisitor.prototype.visitLiteralPrimitive.parameters = [[LiteralPrimitive]];
WatchVisitor.prototype.visitLiteralString.parameters = [[LiteralString]];
WatchVisitor.prototype.visitLiteralArray.parameters = [[LiteralArray]];
WatchVisitor.prototype.visitLiteralObject.parameters = [[LiteralObject]];
WatchVisitor.prototype.visitFilter.parameters = [[Filter]];
WatchVisitor.prototype.visitCallFunction.parameters = [[CallFunction]];
WatchVisitor.prototype.visitAssign.parameters = [[Assign]];
WatchVisitor.prototype.visitLiteral.parameters = [[Literal]];
WatchVisitor.prototype.visitExpression.parameters = [[Expression]];
WatchVisitor.prototype.visitChain.parameters = [[Chain]];
WatchVisitor.prototype._notSupported.parameters = [[name]];
WatchVisitor.prototype._toAst.parameters = [[ArrayOfExpression]];
function operationToFunction(operation) {
  assert.argumentTypes(operation, $traceurRuntime.type.string);
  switch (operation) {
    case '!':
      return function(value) {
        return !value;
      };
    case '+':
      return function(left, right) {
        return autoConvertAdd(left, right);
      };
    case '-':
      return function(left, right) {
        return (left != null && right != null) ? left - right : (left != null ? left : (right != null ? 0 - right : 0));
      };
    case '*':
      return function(left, right) {
        return (left == null || right == null) ? null : left * right;
      };
    case '/':
      return function(left, right) {
        return (left == null || right == null) ? null : left / right;
      };
    case '~/':
      return function(left, right) {
        return (left == null || right == null) ? null : Math.floor(left / right);
      };
    case '%':
      return function(left, right) {
        return (left == null || right == null) ? null : left % right;
      };
    case '==':
      return function(left, right) {
        return left == right;
      };
    case '!=':
      return function(left, right) {
        return left != right;
      };
    case '<':
      return function(left, right) {
        return (left == null || right == null) ? null : left < right;
      };
    case '>':
      return function(left, right) {
        return (left == null || right == null) ? null : left > right;
      };
    case '<=':
      return function(left, right) {
        return (left == null || right == null) ? null : left <= right;
      };
    case '>=':
      return function(left, right) {
        return (left == null || right == null) ? null : left >= right;
      };
    case '^':
      return function(left, right) {
        return (left == null || right == null) ? null : left ^ right;
      };
    case '&':
      return function(left, right) {
        return (left == null || right == null) ? null : left & right;
      };
    case '&&':
      return function(left, right) {
        return !!left && !!right;
      };
    case '||':
      return function(left, right) {
        return !!left || !!right;
      };
    default:
      throw new Error(operation);
  }
}
operationToFunction.parameters = [[$traceurRuntime.type.string]];
function operation_ternary(condition, yes, no) {
  return !!condition ? yes : no;
}
function operation_bracket(obj, key) {
  return obj == null ? null : obj[key];
}
function autoConvertAdd(a, b) {
  if (a != null && b != null) {
    if (typeof a == 'string' && typeof b != 'string') {
      return a + b.toString();
    }
    if (typeof a != 'string' && typeof b == 'string') {
      return a.toString() + b;
    }
    return a + b;
  }
  if (a != null) {
    return a;
  }
  if (b != null) {
    return b;
  }
  return 0;
}
function arrayFn() {
  for (var existing = [],
      $__2 = 0; $__2 < arguments.length; $__2++)
    existing[$__2] = arguments[$__2];
  return existing;
}
function mapFn(keys) {
  return function() {
    for (var values = [],
        $__3 = 0; $__3 < arguments.length; $__3++)
      values[$__3] = arguments[$__3];
    assert(values.length == keys.length);
    var instance = {},
        length = keys.length,
        i;
    for (i = 0; i < length; i++) {
      instance[keys[i]] = values[i];
    }
    return instance;
  };
}
function filterWrapper(filterFn, length) {
  var args = [],
      argsWatches = [];
  return function() {
    for (var values = [],
        $__3 = 0; $__3 < arguments.length; $__3++)
      values[$__3] = arguments[$__3];
    for (var i = 0,
        length = values.length; i < length; i++) {
      var value = values[i];
      var lastValue = args[i];
      if (value !== lastValue) {
        if (value instanceof CollectionChangeRecord) {
          args[i] = value.iterable;
        } else {
          args[i] = value;
        }
      }
    }
    var value = filterFn.apply(null, $traceurRuntime.toObject(args));
    return value;
  };
}
function assert(condition, message) {
  if (!condition) {
    throw message || "Assertion failed";
  }
}
module.exports = {
  get WatchParser() {
    return WatchParser;
  },
  __esModule: true
};
