// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import Panic, { Note } from "../../panic.ts";
import { ensureRVal, Node, Resolvable, RVal } from "../ast.ts";

import Keyword from "./keyword.ts";
import Block from "./block.ts";
import { CID, ID, Query } from "./id.ts";

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

export default class Def extends AST.Node
  implements Resolvable<DST.FunctionDef>, Node {
  readonly modifiers: Keyword<Lang.Keyword.BUILTIN>[];
  /** `def` */ readonly keyword: AST.Node;
  readonly id: AST.Node;
  readonly args: DefArg[];
  readonly returnType?: CID | ID | Query;
  readonly body?: Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { modifiers = [], keyword, id, args, returnType, body }: {
      modifiers: Keyword<Lang.Keyword.BUILTIN>[];
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

    const builtinModifier = this.modifiers.find((m) =>
      m.kind == Lang.Keyword.BUILTIN
    );

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
