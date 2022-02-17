import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as Lang from "../lang.ts";
import * as OnyxAST from "../ast.ts";
import * as CDST from "../../c/dst.ts";
import { Lowerable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";

import { Mappable, RuntimeValue, Scope } from "../dst.ts";

import Ref from "./ref.ts";
import FunctionDef, { BuiltinFunction } from "../dst/function.ts";

export default class Call
  implements
    Lowerable,
    RuntimeValue,
    Mappable<OnyxAST.UnOp | OnyxAST.BinOp | OnyxAST.Call> {
  readonly astNode: OnyxAST.UnOp | OnyxAST.BinOp | OnyxAST.Call;
  readonly callee: Ref;
  readonly args: RuntimeValue[];

  constructor(
    astNode: OnyxAST.UnOp | OnyxAST.BinOp | OnyxAST.Call,
    callee: Ref,
    args: RuntimeValue[],
  ) {
    this.astNode = astNode;
    this.callee = callee;
    this.args = args;
  }

  async lower(output: BufWriter, env: any) {
    if (
      this.callee instanceof CDST.Function && env.safety > Lang.Safety.UNSAFE
    ) {
      throw new Error(
        `Can't call a C function from within a ${env.safety} context`,
      );
    }

    if (this.callee.target instanceof FunctionDef) {
      switch (this.callee.target.builtin) {
        case BuiltinFunction["Bool::!(Bool): Bool"]: {
          await output.write(stringToBytes(`!(`));
          await this.args[0].lower(output, env);
          await output.write(stringToBytes(`)`));
          return;
        }

        case BuiltinFunction["Int32::+(Int32, Int32): Int32"]: {
          await this.args[0].lower(output, env);
          await output.write(stringToBytes(` + `));
          await this.args[1].lower(output, env);
          return;
        }

        case BuiltinFunction["Int32::-(Int32, Int32): Int32"]: {
          await this.args[0].lower(output, env);
          await output.write(stringToBytes(` - `));
          await this.args[1].lower(output, env);
          return;
        }

        case BuiltinFunction["Int32::<(Int32, Int32): Bool"]: {
          await this.args[0].lower(output, env);
          await output.write(stringToBytes(` < `));
          await this.args[1].lower(output, env);
          return;
        }

        case BuiltinFunction["Int32::<=(Int32, Int32): Bool"]: {
          await this.args[0].lower(output, env);
          await output.write(stringToBytes(` <= `));
          await this.args[1].lower(output, env);
          return;
        }

        case BuiltinFunction["Int32::eq?(Int32, Int32): Bool"]: {
          await this.args[0].lower(output, env);
          await output.write(stringToBytes(` == `));
          await this.args[1].lower(output, env);
          return;
        }
      }
    }

    // TODO: Print full path, e.g. `Int32::eq?`.
    await this.callee.lower(output, env);

    await output.write(stringToBytes(`(`));

    let first = true;
    for (const rval of this.args) {
      if (first) first = false;
      else await output.write(stringToBytes(`, `));
      await rval.lower(output, env);
    }

    await output.write(stringToBytes(`)`));
  }

  inferType(scope: Scope): Type {
    return this.callee.inferType(scope);
  }
}
