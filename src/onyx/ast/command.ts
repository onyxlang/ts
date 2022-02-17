// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as AST from "../../ast.ts";
import { ensureRVal, Node, Resolvable, RVal } from "../ast.ts";

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
