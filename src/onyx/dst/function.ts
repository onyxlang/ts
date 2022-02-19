import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as Lang from "../lang.ts";
import * as GenericAST from "../../ast.ts";
import * as AST from "../ast.ts";
import { compareTypes, Exportable } from "../dst.ts";
import { Identifiable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";
import Panic from "../../panic.ts";

import { Mappable, Scope } from "../dst.ts";

import Block from "./block.ts";
import Ref from "./ref.ts";
import VariableDef from "./variable.ts";
import Unit from "../../unit.ts";

export enum BuiltinFunction {
  "Bool::!(Bool): Bool",
  "Int32::-(Int32, Int32): Int32",
  "Int32::+(Int32, Int32): Int32",
  "Int32::<(Int32, Int32): Bool",
  "Int32::<=(Int32, Int32): Bool",
  "Int32::eq?(Int32, Int32): Bool",
}

export default class FunctionDef
  implements Identifiable, Mappable<AST.Def>, Exportable {
  readonly parent: Scope;
  readonly astNode: AST.Def;
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
      storage,
      safety,
      returnType,
      builtin,
      body,
    }: {
      astNode: AST.Def;
      parent: Scope;
      storage: Lang.Storage;
      safety: Lang.Safety;
      returnType?: Ref;
      builtin?: BuiltinFunction;
      body?: Block;
    },
  ) {
    this.astNode = astNode;
    this.parent = parent;
    this.body = body;
    this.builtin = builtin;
    this.storage = storage;
    this.safety = safety;
    this.returnType = returnType;

    if (builtin && !returnType) {
      throw new Panic(
        `A builtin function must have its return value declared`,
        astNode.builtinModifier!.location,
      );
    }
  }

  unit(): Unit {
    return this.parent.unit();
  }

  idNode(): GenericAST.Node {
    return this.astNode.id;
  }

  id(): string {
    return this.idNode().text;
  }

  exportKeyword(): AST.Keyword<Lang.Keyword.EXPORT> | undefined {
    return this.astNode.exportModifier;
  }

  defaultKeyword(): AST.Keyword<Lang.Keyword.DEFAULT> | undefined {
    return this.astNode.defaultModifier;
  }

  async lower(output: BufWriter, env: any) {
    if (this.body instanceof Block) {
      await output.write(stringToBytes(`pub fn ${this.id()}(`));

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
