import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as OnyxAST from "../ast.ts";
import { UNIVERSE } from "../dst.ts";
import { Lowerable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";

import { Mappable, RuntimeValue, Scope } from "../dst.ts";

export class Return
  implements Lowerable, RuntimeValue, Mappable<OnyxAST.Return> {
  readonly astNode: OnyxAST.Return;
  readonly value?: RuntimeValue;

  constructor(astNode: OnyxAST.Return, value?: RuntimeValue) {
    this.astNode = astNode;
    this.value = value;
  }

  async lower(output: BufWriter, env: any) {
    await output.write(stringToBytes(`return `));
    await (this.value ? this.value.lower(output, env) : `void`);
  }

  inferType(scope: Scope): Type {
    return this.value ? this.value.inferType(scope) : UNIVERSE.Void;
  }
}
