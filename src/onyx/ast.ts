// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as DST from "./dst.ts";
import Panic from "../panic.ts";

export { default as Keyword } from "./ast/keyword.ts";

import Extern from "./ast/extern.ts";
export { default as Extern } from "./ast/extern.ts";

import Final from "./ast/final.ts";
export { default as Final } from "./ast/final.ts";

import Struct from "./ast/struct.ts";
export { default as Struct } from "./ast/struct.ts";

import Def from "./ast/def.ts";
export { DefArg, default as Def } from "./ast/def.ts";

import { ExplicitSafety } from "./ast/block.ts";
export { default as Block, ExplicitSafety } from "./ast/block.ts";

import Call from "./ast/call.ts";
export { BinOp, default as Call, UnOp } from "./ast/call.ts";

import { ID } from "./ast/id.ts";
export * from "./ast/id.ts";

import { If } from "./ast/branch.ts";
export * from "./ast/branch.ts";

import { IntLiteral } from "./ast/literal.ts";
export * from "./ast/literal.ts";

import { Return } from "./ast/command.ts";
export * from "./ast/command.ts";

// A top-level directive.
export type Directive = Extern;

// A entity declaration.
export type Declaration = Final | Struct | Def;

// A statement, like a sentence.
export type Statement = If | ExplicitSafety;

// A single instruction, may be part of a statement.
export type Instruction = Return;

// An rvalue may be directly used as an argument.
export type RVal = Call | ExplicitSafety | Literal | Instruction | ID;

// A literal, like a "baked-in" source code value.
export type Literal = IntLiteral;

// An expression may be a part of a block.
export type Expression = Declaration | Statement | RVal;

// `trait Resolvable<T> derive Node`.
export interface Resolvable<T> {
  resolve(syntax: DST.Scope, semantic?: any): T;
}

// HACK: Used because `OnyxAST.Resolvable[]` is illegal.
export interface Node {
  resolve(syntax: DST.Scope, semantic?: any): any;
}

export function ensureRVal(
  dstNode: any,
  location: peggy.LocationRange,
): DST.Ref | DST.Call | DST.IntLiteral | DST.Return {
  if (
    !(dstNode instanceof DST.Ref || dstNode instanceof DST.Call ||
      dstNode instanceof DST.IntLiteral || dstNode instanceof DST.Return)
  ) {
    throw new Panic(
      `Expected ref, call, explicit safety statement or literal, ` +
        `got ${dstNode.constructor.name}`,
      location,
    );
  }

  return dstNode;
}
