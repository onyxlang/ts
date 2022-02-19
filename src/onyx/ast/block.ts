// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import { ensureRVal, Expression, Node, Resolvable, RVal } from "../ast.ts";

export default class Block extends AST.Node implements Resolvable<DST.Block> {
  readonly body: (Expression)[];

  constructor(
    location: peggy.LocationRange,
    text: string,
    { body }: { body: (Expression)[] },
  ) {
    super(location, text);
    this.body = body;
  }

  async resolve(syntax: DST.Scope, _semantic?: any): Promise<DST.Block> {
    const dst = new DST.Block(this, syntax, syntax.safety);

    for (const expr of this.body) {
      dst.body.push(await expr.resolve(dst, undefined));
    }

    return dst;
  }
}

export class ExplicitSafety extends AST.Node
  implements Resolvable<DST.Block>, Node {
  readonly safety: Lang.Safety;
  readonly body: RVal | Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { safety, body }: {
      safety: Lang.Safety;
      body: RVal | Block;
    },
  ) {
    super(location, text);
    this.safety = safety;
    this.body = body;
  }

  async resolve(syntax: DST.Scope, _semantic?: any): Promise<DST.Block> {
    let block: DST.Block;

    if (this.body instanceof Block) {
      block = new DST.Block(this.body, syntax, this.safety);

      for (const expr of this.body.body) {
        block.body.push(await expr.resolve(block));
      }
    } else {
      block = new DST.Block(undefined, syntax, this.safety);
      block.body.push(
        ensureRVal(await this.body.resolve(block), this.body.location),
      );
    }

    return block;
  }
}
