import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as OnyxAST from "../ast.ts";
import { Lowerable } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";
import Panic from "../../panic.ts";

import { Mappable, RuntimeValue, Scope } from "../dst.ts";

import StructDef from "./struct.ts";

export class IntLiteral
  implements Lowerable, RuntimeValue, Mappable<OnyxAST.IntLiteral> {
  readonly astNode: OnyxAST.IntLiteral;
  readonly value: number;

  constructor(astNode: OnyxAST.IntLiteral, value: number) {
    this.astNode = astNode;
    this.value = value;
  }

  async lower(output: BufWriter, _env: any) {
    await output.write(stringToBytes(`${this.value}`));
  }

  inferType(scope: Scope): StructDef {
    const found = scope.find("Int32");

    if (!found) {
      throw new Panic(
        "Can't find builtin struct `Int32`",
        this.astNode.location,
      );
    }

    if (!(found instanceof StructDef)) {
      throw new Panic("Unexpected type for `Int32`", this.astNode.location);
    }

    return found;
  }
}
