// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as AST from "../../ast.ts";
import { Node, Resolvable } from "../ast.ts";

export class IntLiteral extends AST.Node
  implements Resolvable<DST.IntLiteral>, Node {
  async resolve(
    _syntaxScope: DST.Scope,
    _semantic?: any,
  ): Promise<DST.IntLiteral> {
    return await new DST.IntLiteral(this, parseInt(this.text));
  }
}

export class StringLiteral extends AST.Node
  implements Resolvable<DST.StringLiteral>, Node {
  readonly value: string;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { value }: { value: string },
  ) {
    super(location, text);
    this.value = value;
  }

  resolve(_syntax: DST.Scope, _semantic?: any): Promise<DST.StringLiteral> {
    throw new Error("Method not implemented.");
  }
}
