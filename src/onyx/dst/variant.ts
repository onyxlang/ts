import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import { compareTypes } from "../dst.ts";
import { Lowerable, Type } from "../../dst.ts";
import Unit from "../../unit.ts";

import { Mappable, RuntimeValue, Scope } from "../dst.ts";

import StructDef from "./struct.ts";
import VariableDef from "./variable.ts";
import FunctionDef from "../dst/function.ts";

export default class Variant
  implements RuntimeValue, Lowerable, Type, Scope, Mappable<undefined> {
  readonly astNode: undefined;
  readonly safety = Lang.Safety.THREADSAFE;
  readonly types: Type[];

  constructor(types: Type[]) {
    this.types = types;
  }

  unit(): Unit {
    throw new Error("Method not implemented.");
  }

  lookup(
    _id: string | AST.Node,
  ): VariableDef | StructDef | FunctionDef | undefined {
    throw new Error("Method not implemented.");
  }

  find(_id: string | AST.Node): VariableDef | StructDef | FunctionDef {
    throw new Error("Method not implemented.");
  }

  store(
    _entity: VariableDef | StructDef | FunctionDef,
  ): VariableDef | StructDef | FunctionDef {
    throw new Error("Method not implemented.");
  }

  normalize(): Variant {
    const types = [...new Set(this.types.flat(1))];
    types.sort(compareTypes);
    return new Variant(types);
  }

  inferType(_scope: Scope): Type {
    const normalized = this.normalize();
    if (normalized.types.length == 1) return normalized.types[0];
    else return normalized;
  }

  lower(_output: BufWriter, _env: any): Promise<void> {
    throw new Error("Method not implemented.");
  }

  name(): string {
    return `Variant<\`${this.types.map((t) => t.name()).join(", ")}\`>`;
  }

  scopeId(): string {
    return "";
  }
}
