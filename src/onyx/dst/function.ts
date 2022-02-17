import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import * as OnyxAST from "../ast.ts";
import { compareTypes } from "../dst.ts";
import { Identifiable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";
import Panic from "../../panic.ts";

import { Mappable, Scope } from "../dst.ts";

import Block from "./block.ts";
import Ref from "./ref.ts";
import VariableDef from "./variable.ts";

export enum BuiltinFunction {
  "Bool::!(Bool): Bool",
  "Int32::-(Int32, Int32): Int32",
  "Int32::+(Int32, Int32): Int32",
  "Int32::<(Int32, Int32): Bool",
  "Int32::<=(Int32, Int32): Bool",
  "Int32::eq?(Int32, Int32): Bool",
}

export default class FunctionDef
  implements Identifiable, Mappable<OnyxAST.Def> {
  readonly parent: Scope;
  readonly astNode: OnyxAST.Def;
  readonly id: string;
  readonly args = new Map<string, VariableDef>();
  body?: Block;
  readonly returnType?: Ref;
  readonly builtin?: BuiltinFunction;
  readonly storage: Lang.Storage;
  readonly safety: Lang.Safety;

  constructor(
    {
      astNode,
      parent,
      id,
      storage,
      safety,
      returnType,
      builtin,
      body,
    }: {
      astNode: OnyxAST.Def;
      parent: Scope;
      id: string;
      storage: Lang.Storage;
      safety: Lang.Safety;
      returnType?: Ref;
      builtin?: BuiltinFunction;
      body?: Block;
    },
  ) {
    this.astNode = astNode;
    this.parent = parent;
    this.id = id;
    this.body = body;
    this.builtin = builtin;
    this.storage = storage;
    this.safety = safety;
    this.returnType = returnType;

    if (builtin && !returnType) {
      throw new Panic(
        `A builtin function must have its return value declared`,
        astNode.modifiers.find((m) => m.text == "@builtin")?.location,
      );
    }
  }

  idNode(): AST.Node {
    return this.astNode.id;
  }

  async lower(output: BufWriter, env: any) {
    if (this.body instanceof Block) {
      await output.write(stringToBytes(`fn ${this.id}(`));

      let first = true;
      for (const [_, arg] of this.args) {
        if (first) first = false;
        else await output.write(stringToBytes(`, `));
        await arg.lower(output, env);
      }

      await output.write(stringToBytes(`) `));
      await this.returnType?.lower(output, env);
      await output.write(stringToBytes(` {\n`));
      await this.body.lower(output, env);
      await output.write(stringToBytes(`\n}\n`));
    } else {
      return await void 0; // A builtin function isn't lowered
    }
  }

  unop(): boolean {
    switch (this.storage) {
      case Lang.Storage.LOCAL:
      case Lang.Storage.STATIC:
        return this.args.size == 1;
      case Lang.Storage.INSTANCE:
        return this.args.size == 0;
    }
  }

  binop(): boolean {
    switch (this.storage) {
      case Lang.Storage.LOCAL:
      case Lang.Storage.STATIC:
        return this.args.size == 2;
      case Lang.Storage.INSTANCE:
        return this.args.size == 1;
    }
  }

  inferReturnType(scope: Scope): Type {
    if (this.returnType) {
      const returnType = this.returnType.inferType(scope);

      if (this.builtin) {
        return returnType;
      } else {
        const bodyReturn = this.body!.inferType(scope);

        if (compareTypes(bodyReturn, returnType)) {
          throw new Panic(
            `Inferred block return type \`${bodyReturn.name()}\` doesn't match ` +
              `the declared function return type \`${returnType.name()}\``,
          );
        }

        return returnType;
      }
    } else if (this.builtin) {
      throw new Error("BUG");
    } else {
      return this.body!.inferType(scope);
    }
  }
}
