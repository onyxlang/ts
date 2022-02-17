import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import * as OnyxAST from "../ast.ts";
import { Expression } from "../dst.ts";
import { Identifiable, Lowerable, Type } from "../../dst.ts";
import Unit from "../../unit.ts";
import Panic from "../../panic.ts";

import { Mappable, Scope } from "../dst.ts";

import VariableDef from "./variable.ts";
import FunctionDef from "./function.ts";

export enum BuiltinStruct {
  Bool = "Bool",
  Int32 = "Int32",
}

export default class StructDef
  implements Lowerable, Identifiable, Scope, Type, Mappable<OnyxAST.Struct> {
  readonly parent?: Scope;
  readonly safety = Lang.Safety.FRAGILE;
  readonly astNode: OnyxAST.Struct;
  readonly id: string;
  readonly builtin?: BuiltinStruct;

  private readonly variables = new Map<string, VariableDef>();
  private readonly functions = new Map<string, FunctionDef>();
  private readonly structs = new Map<string, StructDef>();

  constructor(
    parent: Scope,
    astNode: OnyxAST.Struct,
    id: string,
    builtin?: BuiltinStruct,
  ) {
    this.parent = parent;
    this.astNode = astNode;
    this.id = id;
    this.builtin = builtin;
  }

  lookup(
    id: AST.Node | string,
  ): VariableDef | FunctionDef | StructDef | undefined {
    const found = this.functions.get(id instanceof AST.Node ? id.text : id);
    if (found) return found;
    // TODO: This is wrong, shall split scope to semantic and syntax.
    else if (this.parent) return this.parent.lookup(id);
  }

  find(id: AST.Node | string): VariableDef | FunctionDef | StructDef {
    const found = this.lookup(id);

    if (!found) {
      throw new Panic(
        `Undeclared \`${this.scopeId()}${
          id instanceof AST.Node ? id.text : id
        }\``,
        id instanceof AST.Node ? id.location : undefined,
      );
    } else {
      return found;
    }
  }

  store(
    entity: VariableDef | StructDef | FunctionDef | Expression,
  ): typeof entity {
    if (entity instanceof VariableDef) this.variables.set(entity.id, entity);
    if (entity instanceof StructDef) this.structs.set(entity.id, entity);
    if (entity instanceof FunctionDef) this.functions.set(entity.id, entity);
    else {
      throw new Panic(
        "A struct definition can't contain an expression",
        entity.astNode?.location,
      );
    }
    return entity;
  }

  idNode(): AST.Node {
    return this.astNode.id;
  }

  scopeId(): string {
    return `${this.id}::`;
  }

  async lower(_output: BufWriter, _env: any) {
    if (this.builtin) return await void 0;
    else throw new Error("Can't have a non-builtin struct yet");
  }

  unit(): Unit {
    return this.parent!.unit();
  }

  name(): string {
    return this.id;
  }
}
