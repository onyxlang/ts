// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as AST from "../../ast.ts";
import Panic, { Note } from "../../panic.ts";
import { ensureRVal, Node, Resolvable, RVal } from "../ast.ts";

import { CID, ID, Query } from "./id.ts";

export default class Final extends AST.Node
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
