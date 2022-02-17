// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";
import * as DST from "../dst.ts";
import * as Lang from "../lang.ts";
import * as CAST from "../../c/ast.ts";
import * as AST from "../../ast.ts";
import Panic from "../../panic.ts";
import { Node, Resolvable } from "../ast.ts";
import Keyword from "./keyword.ts";

export default class Extern extends AST.Node
  implements Resolvable<DST.Extern>, Node {
  readonly keyword: Keyword<Lang.Keyword.EXTERN>;
  readonly value: CAST.Prototype;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { keyword, value }: {
      keyword: Keyword<Lang.Keyword.EXTERN>;
      value: CAST.Prototype;
    },
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
