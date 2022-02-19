import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";
import * as Lang from "./lang.ts";
import * as AST from "./ast.ts";
import * as GenericAST from "../ast.ts";
import * as GenericDST from "../dst.ts";
import { Type } from "../dst.ts";
import Unit from "../unit.ts";

export { default as TopLevel } from "./dst/top_level.ts";
export { default as Block } from "./dst/block.ts";
export { default as Call } from "./dst/call.ts";
export { default as Ref } from "./dst/ref.ts";

import Void from "./dst/void.ts";
export { default as Void } from "./dst/void.ts";

import Extern from "./dst/extern.ts";
export { default as Extern } from "./dst/extern.ts";

import Import from "./dst/import.ts";
export { default as Import } from "./dst/import.ts";

import StructDef from "./dst/struct.ts";
export { BuiltinStruct, default as StructDef } from "./dst/struct.ts";

import FunctionDef from "./dst/function.ts";
export { BuiltinFunction, default as FunctionDef } from "./dst/function.ts";

import VariableDef from "./dst/variable.ts";
export { default as VariableDef } from "./dst/variable.ts";

import { If } from "./dst/branching.ts";
export { Case, If } from "./dst/branching.ts";

import { IntLiteral, StringLiteral } from "./dst/literal.ts";
export * from "./dst/literal.ts";

import { Return } from "./dst/command.ts";
export { Return } from "./dst/command.ts";

export type Directive = Extern | Import;
export type Declaration = VariableDef | FunctionDef | StructDef;
export type Statement = If;
export type Instruction = Return;
export type Literal = IntLiteral | StringLiteral;
export type Expression = Declaration | Statement | Instruction | RuntimeValue;

export const UNIVERSE = {
  Void: new Void(),
};

export interface RuntimeValue {
  readonly astNode: any;
  inferType(scope: Scope): Type;
  lower(output: BufWriter, env: any): Promise<void>;
}

export interface Scope {
  readonly parent?: Scope;
  readonly safety: Lang.Safety;
  scopeId(): string;
  unit(): Unit;
  lookup(
    id: GenericAST.Node | string,
  ): GenericDST.Identifiable | Void | undefined;
  find(id: GenericAST.Node | string): GenericDST.Identifiable | Void;
  store(entity: GenericDST.Identifiable | Expression): typeof entity;
}

export interface Mappable<T> {
  readonly astNode: T;
}

export interface Exportable {
  exportKeyword(): AST.Keyword<Lang.Keyword.EXPORT> | undefined;
  defaultKeyword(): AST.Keyword<Lang.Keyword.DEFAULT> | undefined;
  unit(): Unit;
  id(): string;
  idNode(): GenericAST.Node; // TODO: Ditto.
}

export function compareTypes(_a: Type, _b: Type): number {
  return 0; // TODO:
}
