import { Node } from "../ast.ts";
import * as CST from "./cst.ts";
import * as CAST from "../c/ast.ts";
import Unit from "../unit.ts";
import * as Lang from "./lang.ts";
import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";
import Panic, { Note } from "../panic.ts";
import { stringToBytes } from "../util.ts";

enum BuiltinFunction {
  Int32Sum,
  Int32Eq,
}

/**
 * A scope contains lookup-able entities.
 */
abstract class Scope {
  private _unit?: Unit;
  private _parent?: Scope;
  protected _safety: Lang.Safety;

  protected _adjacentCommentNode?: CST.Comment;
  protected _funcDefs = new Map<string, FunctionDef>();

  constructor(
    unit: Unit | undefined,
    parent: Scope | undefined,
    safety: Lang.Safety,
  ) {
    this._unit = unit;
    this._parent = parent;
    this._safety = safety;
  }

  unit(): Unit {
    if (this._unit) return this._unit;
    else if (this._parent) return this._parent.unit();
    else throw new Error("A scope must have either `_unit` or `_parent` set");
  }

  safety(): Lang.Safety {
    return this._safety;
  }

  protected compile(node: CST.Any) {
    let setCommentNode = false;

    if (node instanceof CST.Comment) {
      this._adjacentCommentNode = node;
      setCommentNode = true;
    } //

    //
    else if (
      node instanceof CST.poly.Newline || node instanceof CST.poly.Multiline
    ) {
      // Skip empty spaces.
    } //

    //
    else if (node instanceof CST.Extern) {
      throw new Panic(
        "An `extern` directive is illegal in this scope",
        node.keyword.loc(),
      );
    } //

    //
    else if (node instanceof CST.FuncIon) {
      const def = FunctionDef.compile(this, node);
      this.addFuncDef(def);
    } //

    //
    else if (node instanceof CST.VarIon) {
      throw new Error("Varion compilation isn't implemented yet");
    } //

    //
    else if (
      node instanceof CST.ExplicitSafetyStatement ||
      node instanceof CST.IntLiteral ||
      node instanceof CST.FFIStringLiteral ||
      node instanceof CST.Call || node instanceof CST.Block
    ) {
      throw new Panic("An expression is illegal in this scope", node.loc());
    }

    if (!setCommentNode) this._adjacentCommentNode = undefined;
  }

  /**
   * @throws Panic if the ID is already declared.
   */
  protected addFuncDef(def: FunctionDef) {
    const found = this.syntaxLookup(def.cstNode.idToken);

    if (found) {
      throw new Panic(
        `Already declared id \`${def.cstNode.idToken.value}\``,
        def.cstNode.idToken.loc(),
        [new Note("Previously declared here", found.cstNode.idToken.loc())],
      );
    }

    this._funcDefs.set(def.cstNode.idToken.value, def);
  }

  syntaxLookup(id: CST.ID): FunctionDef | undefined {
    const found = this._funcDefs.get(id.value);

    if (found) return found;
    else if (this._parent) return this._parent.syntaxLookup(id);
    else return undefined;
  }
}

class Block extends Scope implements Node {
  /** It won't be set for the top-level code block. */
  protected _cstNode?: CST.Block;

  private _exprs = new Array<Expr>();

  constructor(
    cstNode: CST.Block | undefined,
    parent: Scope,
  ) {
    super(undefined, parent, parent.safety());
    this._cstNode = cstNode;
  }

  compile(node: CST.Any): Expr | undefined {
    let result: Expr | undefined;

    if (
      node instanceof CST.Comment || node instanceof CST.poly.Newline ||
      node instanceof CST.poly.Multiline || node instanceof CST.Extern ||
      node instanceof CST.FuncIon || node instanceof CST.VarIon
    ) {
      super.compile(node);
    } //

    //
    else if (node instanceof CST.ExplicitSafetyStatement) {
      const previousSafety = this._safety;
      this._safety = node.safety(); // Temporarily change the block's safety
      result = this.compile(node.content);
      this._safety = previousSafety; // Restore the original safety
    } //

    //
    else if (node instanceof CST.IntLiteral) {
      result = new IntLiteral(node);
    } //

    //
    else if (node instanceof CST.FFIStringLiteral) {
      result = new FFIStringLiteral(node);
    } //

    //
    else if (node instanceof CST.Call) {
      result = Call.compile(this, node);
      this._exprs.push(result as Expr);
    } //

    //
    else if (node instanceof CST.Block) {
      result = new Block(node, this);

      for (const child of node.nodes) {
        result.compile(child);
      }

      this._exprs.push(result as Expr);
    } //

    //
    else if (node instanceof CST.If) {
      result = If.compile(this, node);
      this._exprs.push(result as Expr);
    } //

    //
    else {
      throw new Error("Unhandled CST node type: " + Deno.inspect(node));
    }

    return result;
  }

  async lower(output: BufWriter, _context?: any) {
    for (const expr of this._exprs) {
      await expr.lower(output);
    }
  }
}

/**
 * The top-level block.
 */
export class TopLevel extends Scope implements Node {
  private _cAST: CAST.Root;
  _implicitMain: Block;

  constructor(unit: Unit) {
    super(unit, undefined, Lang.Safety.FRAGILE);
    this._implicitMain = new Block(undefined, this);
    this._cAST = new CAST.Root();
  }

  compile(node: CST.Any) {
    // Extern is only allowed in the top level.
    if (node instanceof CST.Extern) {
      const proto = this.unit().program().compileCProto(node.value);
      this._cAST.children.push(proto);
    } //

    // These nodes are common for any scope.
    else if (
      node instanceof CST.Comment || node instanceof CST.poly.Newline ||
      node instanceof CST.poly.Multiline || node instanceof CST.FuncIon ||
      node instanceof CST.VarIon
    ) {
      super.compile(node);
    } //

    // Expression nodes are courtesy of the implicit main block.
    else if (
      node instanceof CST.ExplicitSafetyStatement ||
      node instanceof CST.IntLiteral ||
      node instanceof CST.FFIStringLiteral ||
      node instanceof CST.Call || node instanceof CST.Block ||
      node instanceof CST.If
    ) {
      this._implicitMain.compile(node);
    } //

    //
    else {
      throw new Error("Unhandled CST node type: " + Deno.inspect(node));
    }
  }

  syntaxLookup(id: CST.ID): FunctionDef | undefined {
    // TODO: Lookup in imports.
    //

    const found = this._funcDefs.get(id.value);

    if (found) return found;
    else return undefined;
  }

  async lower(output: BufWriter, _context?: any) {
    await this._cAST.lower(output);

    for (const funcDef of this._funcDefs) {
      await funcDef[1].lower(output);
    }

    await output.write(stringToBytes("pub fn main() void {\n"));
    await this._implicitMain.lower(output);
    await output.write(stringToBytes("}"));
  }
}

class FunctionDef implements Node {
  cstNode: CST.FuncIon;
  builtin: BuiltinFunction;

  /**
   * NOTE: The node def isn't added to the _scope_ yet.
   */
  static compile(scope: Scope, cstNode: CST.FuncIon): FunctionDef {
    const found = scope.syntaxLookup(cstNode.idToken);

    if (found) {
      throw new Panic(
        `Already declared id \`${cstNode.idToken.value}\``,
        cstNode.idToken.loc(),
        [new Note("Previously declared here", found.cstNode.idToken.loc())],
      );
    }

    if (cstNode.idToken.value == "sum") {
      return new FunctionDef(cstNode, BuiltinFunction.Int32Sum);
    } else if (cstNode.idToken.value == "eq?") {
      return new FunctionDef(cstNode, BuiltinFunction.Int32Eq);
    } else {
      throw new Panic(
        "Custom function definitions aren't implemented yet",
        cstNode.idToken.loc(),
      );
    }
  }

  private constructor(cstNode: CST.FuncIon, builtin: BuiltinFunction) {
    this.cstNode = cstNode;
    this.builtin = builtin;
  }

  async lower(_output: BufWriter, _context?: any) {
    // Noop for now.
  }
}

class IntLiteral implements Node {
  cstNode: CST.IntLiteral;

  constructor(cstNode: CST.IntLiteral) {
    this.cstNode = cstNode;
  }

  async lower(output: BufWriter, _context?: any) {
    await output.write(stringToBytes(this.cstNode.raw));
  }
}

class FFIStringLiteral implements Node {
  cstNode: CST.FFIStringLiteral;

  constructor(cstNode: CST.FFIStringLiteral) {
    this.cstNode = cstNode;
  }

  async lower(output: BufWriter, _context?: any) {
    await output.write(stringToBytes(`"${this.cstNode.value}"`));
  }
}

class Call implements Node {
  cstNode: CST.Call;
  callee: CAST.Proto | FunctionDef;
  args: Expr[];

  static compile(block: Block, cstNode: CST.Call): Call {
    let callee;

    switch (cstNode.callee.kind) {
      case CST.IDKind.COMMON: {
        callee = block.syntaxLookup(cstNode.callee);

        if (!callee) {
          throw new Panic(
            `Undeclared \`${cstNode.callee.value}\``,
            cstNode.callee.loc(),
          );
        }

        break;
      }
      case CST.IDKind.FFI: {
        if (block.safety() > Lang.Safety.UNSAFE) {
          throw new Panic(
            "An FFI call requires unsafe context",
            cstNode.callee.loc(),
          );
        }

        callee = block.unit().program().findCProto(cstNode.callee);
        break;
      }
      case CST.IDKind.LABEL:
      case CST.IDKind.SYMBOL:
        throw Error("Invalid ID kind for a callee: " + cstNode.callee.kind);
    }

    const args = callee instanceof CAST.Proto
      ? new Array<Expr>(callee.args.length)
      : new Array<Expr>();

    let i = 0;

    for (const _arg of cstNode.args.args) {
      if (_arg instanceof CST.KWArg) {
        if (callee instanceof CAST.Proto) {
          const found = callee.argsMap.get(_arg.label.value);

          if (found) {
            args[found.index] = block.compile(_arg.value)!;
          } else {
            throw new Panic(
              `Undeclared argument \`${_arg.label.value}\` for C function \`${callee.id()}\``,
              _arg.label.loc(),
            );
          }
        } else {
          throw new Error(
            "Named arguments for Onyx functions aren't implemented yet",
          );
        }
      } else {
        args[i++] = block.compile(_arg)!;
      }
    }

    return new Call(cstNode, callee, args);
  }

  private constructor(
    cstNode: CST.Call,
    callee: CAST.Proto | FunctionDef,
    args: Expr[],
  ) {
    this.cstNode = cstNode;
    this.callee = callee;
    this.args = args;
  }

  async lower(output: BufWriter, _context?: any) {
    if (this.callee instanceof CAST.Proto) {
      await output.write(stringToBytes(this.callee.id()));
      await output.write(CST.poly.PunctBytes.openParen);

      let first = true;
      for (const arg of this.args) {
        if (first) first = false;
        else await output.write(CST.poly.PunctBytes.comma);
        await arg.lower(output);
      }

      await output.write(CST.poly.PunctBytes.closeParen);
      await output.write(CST.poly.PunctBytes.semi);
    } else if (this.callee instanceof FunctionDef) {
      switch (this.callee.builtin) {
        case BuiltinFunction.Int32Sum: {
          await this.args[0].lower(output);
          await output.write(stringToBytes(" + "));
          await this.args[1].lower(output);
          break;
        }
        case BuiltinFunction.Int32Eq: {
          await this.args[0].lower(output);
          await output.write(stringToBytes(" == "));
          await this.args[1].lower(output);
          break;
        }
        default:
          throw new Error("Unrecognized builtin function");
      }
    } else {
      throw new Error("Unhandled callee AST node type");
    }
  }
}

class Case implements Node {
  cstNode: CST.Case;
  private _cond: Expr;
  private _then: Block;

  static compile(block: Block, cstNode: CST.Case): Case {
    const cond = block.compile(cstNode.cond)!;

    // TODO: Improve.
    const thenBlock = new Block(undefined, block);
    thenBlock.compile(cstNode.body);

    return new Case(cstNode, cond, thenBlock);
  }

  private constructor(cstNode: CST.Case, cond: Expr, then: Block) {
    this.cstNode = cstNode;
    this._cond = cond;
    this._then = then;
  }

  async lower(output: BufWriter, _context?: any) {
    await output.write(CST.poly.PunctBytes.openParen);
    await this._cond.lower(output);
    await output.write(CST.poly.PunctBytes.closeParen);
    await output.write(CST.poly.PunctBytes.openBracket);
    console.dir(this._then);
    await this._then.lower(output);
    await output.write(CST.poly.PunctBytes.closeBracket);
  }
}

class If implements Node {
  cstNode: CST.If;
  private _self: Case;
  private _else?: Block;

  static compile(block: Block, cstNode: CST.If): If {
    const selfBlock = new Block(undefined, block);
    const self = Case.compile(selfBlock, cstNode.self);

    // TODO: Improve.
    let elseBlock: Block | undefined;
    if (cstNode.else) {
      elseBlock = new Block(undefined, selfBlock);
      elseBlock.compile(cstNode.else.body);
    }

    return new If(cstNode, self, elseBlock);
  }

  private constructor(cstNode: CST.If, self: Case, _else?: Block) {
    this.cstNode = cstNode;
    this._self = self;
    this._else = _else;
  }

  async lower(output: BufWriter, _context?: any) {
    await output.write(stringToBytes("if"));
    await this._self.lower(output);

    if (this._else) {
      await output.write(stringToBytes("else"));
      await output.write(CST.poly.PunctBytes.openBracket);
      await this._else!.lower(output);
      await output.write(CST.poly.PunctBytes.closeBracket);
    }
  }
}

type Expr = IntLiteral | FFIStringLiteral | Call | Block | If;
