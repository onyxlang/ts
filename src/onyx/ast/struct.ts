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
  readonly modifiers: Keyword<Lang.Keyword.BUILTIN>[];
  readonly id: AST.Node;
  readonly body: Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { modifiers, id, body }: {
      modifiers: Keyword<Lang.Keyword.BUILTIN>[];
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

    // IDEA: `builtin` is `Modifier` node, can be looked up
    // in the well-known struct modifiers list.
    //

    let builtin: DST.BuiltinStruct | undefined;
    if (this.modifiers.find((m) => m.kind == Lang.Keyword.BUILTIN)) {
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
