import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as AST from "../../ast.ts";
import * as OnyxAST from "./../ast.ts";
import * as CDST from "../../c/dst.ts";
import { Identifiable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";

import { Mappable, RuntimeValue, Scope } from "../dst.ts";

import VariableDef from "./variable.ts";
import FunctionDef from "./function.ts";
import StructDef, { BuiltinStruct } from "./struct.ts";

export default class Ref
  implements
    Identifiable,
    RuntimeValue,
    Mappable<OnyxAST.ID | OnyxAST.CID | OnyxAST.Query | undefined> {
  readonly astNode: OnyxAST.ID | OnyxAST.CID | OnyxAST.Query;
  readonly target:
    | VariableDef
    | FunctionDef
    | StructDef
    | CDST.Function
    | CDST.TypeRef;

  constructor(
    astNode: OnyxAST.ID | OnyxAST.CID | OnyxAST.Query,
    target:
      | VariableDef
      | FunctionDef
      | StructDef
      | CDST.Function
      | CDST.TypeRef,
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
    } else {
      return this.target;
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
    }

    await output.write(stringToBytes(this.target.id));
  }

  idNode(): AST.Node {
    return this.target.idNode();
  }
}
