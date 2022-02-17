import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as OnyxAST from "../ast.ts";
import { Lowerable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";

import { Mappable, RuntimeValue, Scope } from "../dst.ts";

import Block from "./block.ts";
import Variant from "./variant.ts";

export class Case implements RuntimeValue, Mappable<OnyxAST.Case> {
  readonly astNode: OnyxAST.Case;
  readonly cond: RuntimeValue;
  readonly body: Block | RuntimeValue;

  constructor(
    astNode: OnyxAST.Case,
    cond: RuntimeValue,
    body: Block | RuntimeValue,
  ) {
    this.astNode = astNode;
    this.cond = cond;
    this.body = body;
  }

  async lower(output: BufWriter, env: any) {
    await output.write(stringToBytes(`(`));
    await this.cond.lower(output, env);

    if (this.body instanceof Block) {
      await output.write(stringToBytes(`) {\n`));
      await this.body.lower(output, env);
      await output.write(stringToBytes(`;\n}`));
    } else {
      await output.write(stringToBytes(`) { `));
      await this.body.lower(output, env);
      await output.write(stringToBytes(`; }\n`));
    }
  }

  inferType(scope: Scope): Type {
    return this.body.inferType(scope);
  }
}

export class If implements Lowerable, RuntimeValue, Mappable<OnyxAST.If> {
  readonly astNode: OnyxAST.If;
  readonly self: Case;
  readonly elifs: Case[];
  readonly else?: Block | RuntimeValue;

  constructor(
    astNode: OnyxAST.If,
    self: Case,
    elifs: Case[],
    _else?: Block | RuntimeValue,
  ) {
    this.astNode = astNode;
    this.self = self;
    this.elifs = elifs;
    this.else = _else;
  }

  async lower(output: BufWriter, env: any) {
    await output.write(stringToBytes(`if `));
    await this.self.lower(output, env);

    for (const elif of this.elifs) {
      await output.write(stringToBytes(`else if `));
      await elif.lower(output, env);
    }

    if (this.else) {
      if (this.else instanceof Block) {
        await output.write(stringToBytes(`else {\n`));
        await this.else.lower(output, env);
        await output.write(stringToBytes(`;\n}`));
      } else {
        await output.write(stringToBytes(`else { `));
        await this.else.lower(output, env);
        await output.write(stringToBytes(`; }\n`));
      }
    }
  }

  inferType(scope: Scope): Type {
    const result = new Variant([
      this.self.inferType(scope),
      ...this.elifs.map((cases) => cases.inferType(scope)),
    ]);

    if (this.else) result.types.push(this.else.inferType(scope));
    return result.normalize();
  }
}
