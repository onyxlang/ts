// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";

/**
 * An Onyx keyword AST node, e.g. `struct`.
 */
export default class Keyword<T extends Lang.Keyword> extends AST.Node {
  readonly kind: Lang.Keyword;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { kind }: { kind: T },
  ) {
    super(location, text);
    this.kind = kind;
  }
}
