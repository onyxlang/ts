import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as AST from "../../ast.ts";
import * as OnyxAST from "../ast.ts";
import { Expression } from "../dst.ts";
import { Identifiable, Lowerable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";

import { Mappable, Scope } from "../dst.ts";

import Ref from "./ref.ts";

export default class VariableDef
  implements Lowerable, Identifiable, Mappable<OnyxAST.Final | OnyxAST.DefArg> {
  readonly astNode: OnyxAST.Final | OnyxAST.DefArg;
  readonly type: Ref;
  readonly value?: Expression;

  constructor(
    astNode: OnyxAST.Final | OnyxAST.DefArg,
    type: Ref,
    value?: Expression,
  ) {
    this.astNode = astNode;
    this.type = type;
    this.value = value;
  }

  idNode(): AST.Node {
    return this.astNode.id;
  }

  id(): string {
    return this.idNode().text;
  }

  async lower(output: BufWriter, env: any) {
    if (this.astNode instanceof OnyxAST.DefArg) {
      await output.write(stringToBytes(`${this.id()}: `));
    } else {
      await output.write(stringToBytes(`const ${this.id()}: `));
    }

    await this.type.lower(output, env);

    if (this.value) {
      await output.write(stringToBytes(` = `));
      await this.value.lower(output, env);
    }
  }

  inferType(scope: Scope): Type {
    return this.type.inferType(scope);
  }
}
