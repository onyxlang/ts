import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as AST from "../../ast.ts";
import * as OnyxAST from "./../ast.ts";
import * as CDST from "../../c/dst.ts";
import { Identifiable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";

import { Mappable, RuntimeValue, Scope, Void } from "../dst.ts";

import VariableDef from "./variable.ts";
import FunctionDef from "./function.ts";
import StructDef, { BuiltinStruct } from "./struct.ts";

export default class Ref
  implements
    Identifiable,
    RuntimeValue,
    Mappable<OnyxAST.ID | OnyxAST.CID | OnyxAST.Query | undefined> {
  readonly astNode: OnyxAST.ID | OnyxAST.CID | OnyxAST.Query;

  // TODO: `Referenceable`?
  readonly target: Identifiable | Void;

  constructor(
    astNode: OnyxAST.ID | OnyxAST.CID | OnyxAST.Query,
    target: Identifiable | Void,
  ) {
    this.astNode = astNode;
    this.target = target;
  }

  inferType(scope: Scope): Type {
    if (
      this.target instanceof FunctionDef || this.target instanceof CDST.Function
    ) {
      return this.target.inferReturnType(scope);
    } else if (this.target instanceof VariableDef) {
      return this.target.inferType(scope);
    } else if (
      this.target instanceof StructDef || this.target instanceof CDST.TypeRef
    ) {
      return this.target;
    } else {
      throw new Error(
        `Unhandled case, target is \`${this.target.constructor.name}\``,
      );
    }
  }

  async lower(output: BufWriter, _env: any) {
    if (this.target instanceof StructDef) {
      switch (this.target.builtin) {
        case BuiltinStruct.Bool:
          await output.write(stringToBytes(`bool`));
          return;
        case BuiltinStruct.Int32:
          await output.write(stringToBytes(`i32`));
          return;
      }
    } else if (this.target instanceof Void) {
      await output.write(stringToBytes(`void`));
      return;
    }

    await output.write(stringToBytes(this.target.id()));
  }

  idNode(): AST.Node {
    return this.astNode;
  }

  id(): string {
    return this.idNode().text;
  }
}
