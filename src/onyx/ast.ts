// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";
import * as DST from "./dst.ts";
import * as GenericDST from "../dst.ts";
import * as Lang from "./lang.ts";
import * as CAST from "../c/ast.ts";
import * as CDST from "../c/dst.ts";
import * as AST from "../ast.ts";
import Panic, { Note } from "../panic.ts";

// A top-level directive.
type Directive = Extern;

// A entity declaration.
type Declaration = Final | Struct | Def;

// A statement, like a sentence.
type Statement = If | ExplicitSafety;

// A single instruction, may be part of a statement.
type Instruction = Return;

// An rvalue may be directly used as an argument.
type RVal = Call | ExplicitSafety | Literal | Instruction | ID;

// A literal, like a "baked-in" source code value.
type Literal = IntLiteral;

// An expression may be a part of a block.
type Expression = Declaration | Statement | RVal;

// `trait Resolvable<T> derive Node`.
interface Resolvable<T> {
  resolve(syntax: DST.Scope, semantic?: any): T;
}

export interface Node {
  resolve(syntax: DST.Scope, semantic?: any): any;
}

export class Extern extends AST.Node implements Resolvable<DST.Extern>, Node {
  readonly keyword: AST.Node;
  readonly value: CAST.Prototype;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { keyword, value }: { keyword: AST.Node; value: CAST.Prototype },
  ) {
    super(location, text);
    this.keyword = keyword;
    this.value = value;
  }

  resolve(syntax: DST.TopLevel, _semantic?: any): DST.Extern {
    if (!(syntax instanceof DST.TopLevel)) {
      throw new Panic(
        "Can only extern at the top-level scope",
        this.keyword.location,
      );
    }

    const resolved = this.value.resolve(syntax.cDST());
    const dst = new DST.Extern(this, resolved);
    syntax.externs.push(dst);
    return dst;
  }
}

export class Struct extends AST.Node
  implements Resolvable<DST.StructDef>, Node {
  readonly modifiers: AST.Node[];
  readonly id: AST.Node;
  readonly body: Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { modifiers, id, body }: {
      modifiers: AST.Node[];
      id: AST.Node;
      body: Block;
    },
  ) {
    super(location, text);
    this.modifiers = modifiers;
    this.id = id;
    this.body = body;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.StructDef {
    const found = syntax.lookup(this.id);

    if (found) {
      throw new Panic(
        `Already declared \`${this.id.text}\``,
        this.id.location,
        [new Note("Previously declared here", found.idNode().location)],
      );
    }

    // TODO: `@builtin` is `Modifier` node, can be looked up
    // in the well-known struct modifiers list.
    //

    let builtin: DST.BuiltinStruct | undefined;
    if (this.modifiers.find((m) => m.text === "@builtin")) {
      builtin = (<any> DST.BuiltinStruct)[this.id.text];

      if (!builtin) {
        throw new Panic(
          `Unrecognized builtin struct \`${this.id.text}\``,
          this.id.location,
        );
      }
    }

    const dst = new DST.StructDef(syntax, this, this.id.text, builtin);
    syntax.store(dst);

    for (const def of this.body.body) {
      if (def instanceof Def) {
        this.resolveMethod(dst, def);
      } else {
        throw new Panic("A struct may only contain methods", def.location);
      }
    }

    return dst;
  }

  resolveMethod(dst: DST.StructDef, def: Def): DST.FunctionDef {
    const found = dst.lookup(def.id);

    if (found) {
      throw new Panic(`Already defined \`${found.id}\``, def.id.location, [
        new Note(`Previously defined here`, found.astNode.id.location),
      ]);
    }

    return dst.store(def.resolve(dst)) as DST.FunctionDef;
  }
}

export class DefArg extends AST.Node
  implements Resolvable<DST.VariableDef>, Node {
  readonly id: AST.Node;
  readonly type: CID | ID | Query;
  readonly value?: RVal;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { id, type, value }: {
      id: AST.Node;
      type: CID | ID | Query;
      value?: RVal;
    },
  ) {
    super(location, text);
    this.id = id;
    this.type = type;
    this.value = value;
  }

  resolve(
    syntax: DST.Scope,
    semantic: DST.FunctionDef,
  ): DST.VariableDef {
    const found = semantic.args.get(this.id.text);

    if (found) {
      throw new Panic(
        `Already declared argument \`${this.id.text}\``,
        this.id.location,
        [new Note(`Previously declared here`, found.idNode().location)],
      );
    }

    const restriction = syntax.find(this.type);
    if (!(restriction instanceof DST.StructDef)) {
      throw new Panic(
        `Argument restriction must be a struct ID`,
        restriction.astNode.location,
      );
    }

    const value = this.value
      ? ensureRVal(this.value!.resolve(syntax), this.value!.location)
      : undefined;

    const variable = new DST.VariableDef(
      this,
      this.id.text,
      new DST.Ref(this.type, restriction),
      value,
    );

    // FIXME: Shall move the set logic into the scope itself.
    semantic.args.set(this.id.text, variable);

    return variable;
  }
}

export class Def extends AST.Node implements Resolvable<DST.FunctionDef>, Node {
  readonly modifiers: AST.Node[];
  /** `def` */ readonly keyword: AST.Node;
  readonly id: AST.Node;
  readonly args: DefArg[];
  readonly returnType?: CID | ID | Query;
  readonly body?: Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { modifiers = [], keyword, id, args, returnType, body }: {
      modifiers: AST.Node[];
      keyword: AST.Node;
      id: AST.Node;
      args: DefArg[];
      returnType?: CID | ID | Query;
      body?: Block;
    },
  ) {
    super(location, text);
    this.modifiers = modifiers;
    this.keyword = keyword;
    this.id = id;
    this.args = args;
    this.returnType = returnType;
    this.body = body;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.FunctionDef {
    let builtin: DST.BuiltinFunction | undefined;
    let storage: Lang.Storage;
    const safety = Lang.Safety.FRAGILE;

    const returnType = this.returnType?.resolve(syntax);

    if (
      returnType !== undefined && !(returnType.target instanceof DST.StructDef)
    ) {
      throw new Panic(
        `Expected function return type, got \`${returnType.idNode().text}\``,
        this.returnType!.location,
      );
    }

    const builtinModifier = this.modifiers.find((m) => m.text == "@builtin");

    if (builtinModifier) {
      if (syntax instanceof DST.StructDef) {
        if (!returnType) {
          throw new Panic(
            `A builtin function must have its return type declared`,
            builtinModifier.location,
          );
        }

        storage = Lang.Storage.INSTANCE;

        // TODO: Generalize.
        const lookup = `${syntax.id}::${this.id.text}(${
          this.args.map((arg) => arg.type.text).join(`, `)
        }): ${this.returnType!.text}`;

        builtin = (<any> DST.BuiltinFunction)[lookup];

        if (builtin === undefined) {
          throw new Panic(
            `Unrecognized builtin function \`${lookup}\``,
            this.id.location,
          );
        }
      } else {
        throw new Panic(
          `Unrecognized builtin function \`${this.id.text}\``,
          this.id.location,
        );
      }
    } else {
      if (!this.body) {
        throw new Panic(`Function body expected`, this.location);
      }

      if (syntax instanceof DST.StructDef) storage = Lang.Storage.INSTANCE;
      else if (syntax instanceof DST.Block) storage = Lang.Storage.LOCAL;
      else if (syntax instanceof DST.TopLevel) {
        storage = Lang.Storage.STATIC;
      } else throw new Error("Unreachable");
    }

    const dst = new DST.FunctionDef({
      parent: syntax,
      astNode: this,
      id: this.id.text,
      storage,
      safety,
      returnType,
      builtin,
    });

    for (const arg of this.args) {
      arg.resolve(syntax, dst);
    }

    // Shall store before compiling the body to make self-lookup possible.
    syntax.store(dst);

    if (builtin === undefined) {
      dst.body = new DST.Block(this.body!, syntax, safety, dst);

      for (const expr of this.body!.body) {
        dst.body.store(expr.resolve(dst.body, undefined));
      }
    }

    return dst;
  }
}

export class Block extends AST.Node implements Resolvable<DST.Block> {
  readonly body: Expression[];

  constructor(
    location: peggy.LocationRange,
    text: string,
    { body }: { body: Expression[] },
  ) {
    super(location, text);
    this.body = body;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Block {
    const dst = new DST.Block(this, syntax, syntax.safety);

    for (const expr of this.body) {
      dst.body.push(expr.resolve(dst, undefined));
    }

    return dst;
  }
}

export class Final extends AST.Node
  implements Resolvable<DST.VariableDef>, Node {
  readonly id: AST.Node;
  readonly type: CID | ID | Query;
  readonly value: RVal;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { id, type, value }: {
      id: AST.Node;
      type: CID | ID | Query;
      value: RVal;
    },
  ) {
    super(location, text);
    this.id = id;
    this.type = type;
    this.value = value;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.VariableDef {
    const found = syntax.lookup(this.id);

    if (found) {
      throw new Panic(
        `Already declared variable \`${this.id.text}\``,
        this.id.location,
        [new Note(`Previously declared here`, found.idNode().location)],
      );
    }

    const restriction = syntax.find(this.type);
    if (!(restriction instanceof DST.StructDef)) {
      throw new Panic(
        `Variable restriction must be a struct ID`,
        restriction.astNode.location,
      );
    }

    const value = this.value
      ? ensureRVal(this.value!.resolve(syntax), this.value!.location)
      : undefined;

    const variable = new DST.VariableDef(
      this,
      this.id.text,
      new DST.Ref(this.type, restriction),
      value,
    );

    // FIXME: Shall move the set logic into the scope itself.
    syntax.store(variable);

    return variable;
  }
}

export class UnOp extends AST.Node implements Resolvable<DST.Call>, Node {
  /** E.g. `!`. */ readonly operator: ID;
  readonly operand: RVal;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { operator, operand }: {
      operator: ID;
      operand: RVal;
    },
  ) {
    super(location, text);
    this.operator = operator;
    this.operand = operand;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Call {
    return Call.resolveGeneric(this, syntax, this.operand, this.operator, [
      this.operand,
    ]);
  }
}

/**
 * ```nx
 * fib(n - 1) + fib(n - 2)
 * ```
 */
export class BinOp extends AST.Node implements Resolvable<DST.Call>, Node {
  readonly left: RVal;
  /** E.g. `+=` */ readonly operator: ID;
  readonly right: RVal;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { left, operator, right }: {
      left: RVal;
      operator: ID;
      right: RVal;
    },
  ) {
    super(location, text);
    this.left = left;
    this.operator = operator;
    this.right = right;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Call {
    return Call.resolveGeneric(this, syntax, this.left, this.operator, [
      this.left,
      this.right,
    ]);
  }
}

/**
 * ```nx
 * Int32::eq?(result, 55)
 * ```
 */
export class Call extends AST.Node implements Resolvable<DST.Call>, Node {
  readonly callee: CID | ID | Query;
  readonly args: RVal[];

  constructor(
    location: peggy.LocationRange,
    text: string,
    { callee, args }: {
      callee: CID | ID | Query;
      args: RVal[];
    },
  ) {
    super(location, text);
    this.callee = callee;
    this.args = args;
  }

  static resolveGeneric(
    astNode: UnOp | BinOp | Call,
    syntaxScope: DST.Scope,
    callerNode: RVal | undefined, // `n` in `n < 1`
    calleeNode: CID | ID | Query, // `$puts()` | `foo()` | `foo.bar()` | `n < 1`
    argNodes: RVal[],
  ): DST.Call {
    const args = new Array<DST.RuntimeValue>();

    // For `foo.bar()` call, implicitly pass `foo` as the first argument.
    if (
      calleeNode instanceof Query && calleeNode.access == Lang.Access.INSTANCE
    ) {
      args.push(
        ensureRVal(
          calleeNode.container!.resolve(syntaxScope),
          calleeNode.container!.location,
        ),
      );
    }

    for (const arg of argNodes) {
      args.push(ensureRVal(arg.resolve(syntaxScope), arg.location));
    }

    const argTypes = new Array<GenericDST.Type>();

    for (const arg of args) {
      argTypes.push(arg.inferType(syntaxScope));
    }

    let resolveScope = syntaxScope;

    if (callerNode) {
      const caller = ensureRVal(
        callerNode.resolve(syntaxScope),
        callerNode.location,
      );

      const callerType = caller.inferType(syntaxScope);

      if (!(callerType instanceof DST.StructDef)) {
        throw new Panic(
          `Can't have a non-struct value as a caller ` +
            `(\`${callerType.name()}\` inferred)`,
          callerNode.location,
        );
      }

      resolveScope = callerType;
    }

    const callee = calleeNode.resolve(resolveScope);

    if (
      !(callee.target instanceof DST.FunctionDef ||
        callee.target instanceof CDST.Function)
    ) {
      throw new Panic(`\`${calleeNode.text}\` is not a function`);
    }

    // If callee is Onyx function, get its arguments as an array
    // (map insertion ordering consistency is standardized).
    const calleeArgs = callee.target.args instanceof Map
      ? [...callee.target.args.values()]
      : callee.target.args;

    for (let i = 0; i < args.length; i++) {
      const calleeArg = calleeArgs[i];

      if (!calleeArg) {
        throw new Panic("Argument arity mismatch", argNodes[i].location, [
          new Note("Attempted to match this", callee.idNode().location),
        ]);
      }

      if (
        DST.compareTypes(
          calleeArg instanceof DST.VariableDef
            ? calleeArg.inferType(syntaxScope)
            : calleeArg,
          argTypes[i],
        )
      ) {
        throw new Panic("Argument of invalid type", argNodes[i].location, [
          new Note("Declared here", calleeArg.astNode.location),
        ]);
      }
    }

    return new DST.Call(astNode, callee, args);
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Call {
    return Call.resolveGeneric(
      this,
      syntax,
      undefined,
      this.callee,
      this.args,
    );
  }
}

export class Case extends AST.Node implements Resolvable<DST.Case>, Node {
  readonly cond: RVal;
  readonly body: RVal | Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { cond, body }: {
      readonly cond: RVal;
      readonly body: RVal | Block;
    },
  ) {
    super(location, text);
    this.cond = cond;
    this.body = body;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Case {
    const cond = ensureRVal(this.cond.resolve(syntax), this.cond.location);

    if (this.body instanceof Block) {
      return new DST.Case(this, cond, this.body.resolve(syntax));
    } else {
      return new DST.Case(
        this,
        cond,
        ensureRVal(this.body.resolve(syntax), this.body.location),
      );
    }
  }
}

export class If extends AST.Node implements Resolvable<DST.If>, Node {
  readonly self: Case;
  readonly elifs: Case[];
  readonly else?: RVal | Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { self, elifs, _else }: {
      readonly self: Case;
      readonly elifs: Case[];
      readonly _else?: RVal | Block;
    },
  ) {
    super(location, text);
    this.self = self;
    this.elifs = elifs;
    this.else = _else;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.If {
    const self = this.self.resolve(syntax);

    const elifs = new Array<DST.Case>();
    for (const elif of this.elifs) {
      elifs.push(elif.resolve(syntax));
    }

    let dst: DST.If;

    if (this.else) {
      if (this.else instanceof Block) {
        dst = new DST.If(this, self, elifs, this.else.resolve(syntax));
      } else {
        dst = new DST.If(
          this,
          self,
          elifs,
          ensureRVal(this.else.resolve(syntax), this.else.location),
        );
      }
    } else {
      dst = new DST.If(this, self, elifs);
    }

    if (syntax instanceof DST.TopLevel) syntax.store(dst); // FIXME:
    return dst;
  }
}

export class IntLiteral extends AST.Node
  implements Resolvable<DST.IntLiteral>, Node {
  resolve(_syntaxScope: DST.Scope, _semantic?: any): DST.IntLiteral {
    return new DST.IntLiteral(this, parseInt(this.text));
  }
}

export class Return extends AST.Node implements Resolvable<DST.Return>, Node {
  readonly value?: RVal;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { value }: { value?: RVal },
  ) {
    super(location, text);
    this.value = value;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Return {
    if (this.value) {
      const resolved = ensureRVal(
        this.value.resolve(syntax),
        this.value.location,
      );
      return new DST.Return(this, resolved);
    } else {
      return new DST.Return(this);
    }
  }
}

export class ExplicitSafety extends AST.Node
  implements Resolvable<DST.Block>, Node {
  readonly safety: Lang.Safety;
  readonly body: RVal | Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { safety, body }: {
      safety: Lang.Safety;
      body: RVal | Block;
    },
  ) {
    super(location, text);
    this.safety = safety;
    this.body = body;
  }

  resolve(syntax: DST.Scope, _semantic?: any): DST.Block {
    let block: DST.Block;

    if (this.body instanceof Block) {
      block = new DST.Block(this.body, syntax, this.safety);

      for (const expr of this.body.body) {
        block.body.push(expr.resolve(block));
      }
    } else {
      block = new DST.Block(undefined, syntax, this.safety);
      block.body.push(ensureRVal(this.body.resolve(block), this.body.location));
    }

    return block;
  }
}

export class Query extends AST.Node implements Resolvable<DST.Ref>, Node {
  readonly container?: RVal;
  readonly access?: Lang.Access;
  readonly id: ID;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { container, access, id }: {
      container?: RVal;
      access?: Lang.Access;
      id: ID;
    },
  ) {
    super(location, text);
    this.container = container;
    this.access = access;
    this.id = id;
  }

  resolve(
    syntax: DST.Scope,
    _semantic?: any,
  ): DST.Ref {
    if (this.container) {
      const container = ensureRVal(
        this.container.resolve(syntax),
        this.container.location,
      );

      const containerType = container.inferType(syntax);

      if (containerType instanceof DST.StructDef) {
        return this.id.resolve(containerType);
      } else {
        throw new Panic(
          `Can not query type \`${containerType.name()}\``,
          this.container.location,
        );
      }
    } else {
      return this.id.resolve(syntax);
    }
  }
}

export class CID extends AST.Node implements Resolvable<DST.Ref> {
  readonly value: AST.Node;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { value }: { value: AST.Node },
  ) {
    super(location, text);
    this.value = value;
  }

  resolve(
    syntax: DST.Scope,
    _semantic?: any,
  ): DST.Ref {
    return new DST.Ref(this, syntax.unit().program.cDST.find(this.value));
  }
}

// An identifier, like `foo`.
export class ID extends AST.Node implements Resolvable<DST.Ref>, Node {
  resolve(
    syntax: DST.Scope,
    _semantic?: any,
  ): DST.Ref {
    return new DST.Ref(this, syntax.find(this));
  }
}

function ensureRVal(
  dstNode: any,
  location: peggy.LocationRange,
): DST.Ref | DST.Call | DST.IntLiteral | DST.Return {
  if (
    !(dstNode instanceof DST.Ref || dstNode instanceof DST.Call ||
      dstNode instanceof DST.IntLiteral || dstNode instanceof DST.Return)
  ) {
    throw new Panic(
      `Expected ref, call, explicit safety statement or literal, ` +
        `got ${dstNode.constructor.name}`,
      location,
    );
  }

  return dstNode;
}
