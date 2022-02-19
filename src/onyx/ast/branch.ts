// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "../dst.ts";
import * as AST from "../../ast.ts";
import { ensureRVal, Node, Resolvable, RVal } from "../ast.ts";

import Block from "./block.ts";

export class Case extends AST.Node implements Resolvable<DST.Case>, Node {
  readonly cond: RVal;
  readonly body: RVal | Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { cond, body }: {
      readonly cond: RVal;
      readonly body: RVal | Block;
    },
  ) {
    super(location, text);
    this.cond = cond;
    this.body = body;
  }

  async resolve(syntax: DST.Scope, _semantic?: any): Promise<DST.Case> {
    const cond = ensureRVal(
      await this.cond.resolve(syntax),
      this.cond.location,
    );

    if (this.body instanceof Block) {
      return new DST.Case(this, cond, await this.body.resolve(syntax));
    } else {
      return new DST.Case(
        this,
        cond,
        ensureRVal(await this.body.resolve(syntax), this.body.location),
      );
    }
  }
}

export class If extends AST.Node implements Resolvable<DST.If>, Node {
  readonly self: Case;
  readonly elifs: Case[];
  readonly else?: RVal | Block;

  constructor(
    location: peggy.LocationRange,
    text: string,
    { self, elifs, _else }: {
      readonly self: Case;
      readonly elifs: Case[];
      readonly _else?: RVal | Block;
    },
  ) {
    super(location, text);
    this.self = self;
    this.elifs = elifs;
    this.else = _else;
  }

  async resolve(syntax: DST.Scope, _semantic?: any): Promise<DST.If> {
    const self = await this.self.resolve(syntax);

    const elifs = new Array<DST.Case>();
    for (const elif of this.elifs) {
      elifs.push(await elif.resolve(syntax));
    }

    let dst: DST.If;

    if (this.else) {
      if (this.else instanceof Block) {
        dst = new DST.If(this, self, elifs, await this.else.resolve(syntax));
      } else {
        dst = new DST.If(
          this,
          self,
          elifs,
          ensureRVal(await this.else.resolve(syntax), this.else.location),
        );
      }
    } else {
      dst = new DST.If(this, self, elifs);
    }

    if (syntax instanceof DST.TopLevel) syntax.store(dst); // FIXME:
    return dst;
  }
}
