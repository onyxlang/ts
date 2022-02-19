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

  async resolve(
    syntax: DST.Scope,
    semantic: DST.FunctionDef,
  ): Promise<DST.VariableDef> {
    const found = semantic.args.get(this.id.text);

    if (found) {
      throw new Panic(
        `Already declared argument \`${this.id.text}\``,
        this.id.location,
        [new Note(`Previously declared here`, found.idNode().location)],
      );
    }

    const restriction = syntax.find(this.type);
    if (restriction instanceof DST.Void) {
      throw new Panic(`Can't restrict to void`, this.type.location);
    } else if (!(restriction instanceof DST.StructDef)) {
      throw new Panic(
        `Argument restriction must be a struct ID`,
        this.type.location,
        [new Note(`Declared non-struct here`, restriction.idNode().location)],
      );
    }

    const value = this.value
      ? ensureRVal(await this.value!.resolve(syntax), this.value!.location)
      : undefined;

    const variable = new DST.VariableDef(
      this,
      new DST.Ref(this.type, restriction),
      value,
    );

    // FIXME: Shall move the set logic into the scope itself.
    semantic.args.set(this.id.text, variable);

    return variable;
  }
}

type DefModifier =
  | Keyword<Lang.Keyword.BUILTIN>
  | Keyword<Lang.Keyword.EXPORT>
  | Keyword<Lang.Keyword.DEFAULT>;

export default class Def extends AST.Node
  implements Resolvable<DST.FunctionDef>, Node {
  readonly exportModifier?: Keyword<Lang.Keyword.EXPORT>;
  readonly defaultModifier?: Keyword<Lang.Keyword.DEFAULT>;
  readonly builtinModifier?: Keyword<Lang.Keyword.BUILTIN>;
  /** `def` */ readonly keyword: AST.Node;
  readonly id: AST.Node;
  readonly args: DefArg[];
  readonly returnType?: CID | ID | Query;
  readonly body?: Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { modifiers: mods = [], keyword, id, args, returnType, body }: {
      modifiers: DefModifier[];
      keyword: AST.Node;
      id: AST.Node;
      args: DefArg[];
      returnType?: CID | ID | Query;
      body?: Block;
    },
  ) {
    super(location, text);

    this.exportModifier = mods.find((m) => m.kind == Lang.Keyword.EXPORT);
    this.defaultModifier = mods.find((m) => m.kind == Lang.Keyword.DEFAULT);
    if (this.defaultModifier && !this.exportModifier) {
      throw new Panic(
        "Can't have `default` without `export`",
        this.defaultModifier.location,
      );
    }

    this.builtinModifier = mods.find((m) => m.kind == Lang.Keyword.BUILTIN);

    this.keyword = keyword;
    this.id = id;
    this.args = args;
    this.returnType = returnType;
    this.body = body;
  }

  async resolve(syntax: DST.Scope, _semantic?: any): Promise<DST.FunctionDef> {
    let builtin: DST.BuiltinFunction | undefined;
    let storage: Lang.Storage;
    const safety = Lang.Safety.FRAGILE;

    const returnType = await this.returnType?.resolve(syntax);

    if (
      returnType !== undefined &&
      !(returnType.target instanceof DST.StructDef ||
        returnType.target instanceof DST.Void)
    ) {
      throw new Panic(
        `Expected function return type, got \`${returnType.idNode().text}\``,
        this.returnType!.location,
      );
    }

    if (this.builtinModifier) {
      if (syntax instanceof DST.StructDef) {
        if (!returnType) {
          throw new Panic(
            `A builtin function must have its return type declared`,
            this.builtinModifier.location,
          );
        }

        storage = Lang.Storage.INSTANCE;

        // TODO: Generalize.
        //
        // IDEA: Was `syntax.id`; when changed it to function (`id()=>string`),
        // the interoplation continued to work. Onyx shall catch these.
        //
        // IDEA: Got a lot of bugs by making `resolve` async
        // and forgetting to put `await` at every call site, recursively.
        //
        const lookup = `${syntax.id()}::${this.id.text}(${
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
      storage,
      safety,
      returnType,
      builtin,
    });

    for (const arg of this.args) {
      await arg.resolve(syntax, dst);
    }

    // Shall store before compiling the body to make self-lookup possible.
    syntax.store(dst);

    if (this.exportModifier) {
      if (this.defaultModifier) {
        const found = syntax.unit().defaultExport;

        if (found) {
          throw new Panic(
            `Already have default export`,
            this.defaultModifier.location,
            [
              new Note(
                `Previously declared \`default\` here`,
                found.defaultKeyword()!.location,
              ),
            ],
          );
        }

        syntax.unit().defaultExport = dst;
      } else {
        throw new Panic(
          `Non-default export is not implemented yet`,
          this.exportModifier.location,
        );
      }
    }

    if (builtin === undefined) {
      dst.body = new DST.Block(this.body!, syntax, safety, dst);

      for (const expr of this.body!.body) {
        dst.body.store(await expr.resolve(dst.body, undefined));
      }
    }

    return dst;
  }
}
