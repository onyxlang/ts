// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import Panic, { Note } from "../../panic.ts";
import { Node, Resolvable } from "../ast.ts";

import Keyword from "./keyword.ts";
import Block from "./block.ts";
import Def from "./def.ts";

export default class Struct extends AST.Node
  implements Resolvable<DST.StructDef>, Node {
  // TODO: readonly keyword: Keyword<Lang.Keyword.STRUCT>;
  readonly exportModifier?: Keyword<Lang.Keyword.EXPORT>;
  readonly defaultModifier?: Keyword<Lang.Keyword.DEFAULT>;
  readonly builtinModifier?: Keyword<Lang.Keyword.BUILTIN>;
  readonly id: AST.Node;
  readonly body: Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    // IDEA: `{ modifiers: mods: T }`?
    { modifiers: mods, id, body }: {
      modifiers: Keyword<Lang.Keyword.BUILTIN>[];
      id: AST.Node;
      body: Block;
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

    this.id = id;
    this.body = body;
  }

  async resolve(syntax: DST.Scope, _semantic?: any): Promise<DST.StructDef> {
    const found = syntax.lookup(this.id);

    if (found) {
      if (found instanceof DST.Void) {
        throw new Panic(`Can't name a struct \`void\``, this.id.location);
      }

      throw new Panic(
        `Already declared \`${this.id.text}\``,
        this.id.location,
        [new Note("Previously declared here", found.idNode().location)],
      );
    }

    // IDEA: `builtin` is `Modifier` node, can be looked up
    // in the well-known struct modifiers list.
    //

    let builtin: DST.BuiltinStruct | undefined;
    if (this.builtinModifier) {
      builtin = (<any> DST.BuiltinStruct)[this.id.text];

      if (!builtin) {
        throw new Panic(
          `Unrecognized builtin struct \`${this.id.text}\``,
          this.id.location,
        );
      }
    }

    const dst = new DST.StructDef(syntax, this, builtin);
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

    for (const def of this.body.body) {
      if (def instanceof Def) {
        await this.resolveMethod(dst, def);
      } else {
        throw new Panic("A struct may only contain methods", def.location);
      }
    }

    return dst;
  }

  async resolveMethod(dst: DST.StructDef, def: Def): Promise<DST.FunctionDef> {
    const found = dst.lookup(def.id);

    if (found) {
      if (found instanceof DST.Void) {
        throw new Panic(`Can't name a function \`void\``, this.id.location);
      }

      throw new Panic(`Already defined \`${found.id}\``, def.id.location, [
        new Note(`Previously defined here`, found.idNode().location),
      ]);
    }

    return dst.store(await def.resolve(dst)) as DST.FunctionDef;
  }
}
