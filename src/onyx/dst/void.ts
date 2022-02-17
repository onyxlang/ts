import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import { Lowerable, Type } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";
import Unit from "../../unit.ts";
import Panic from "../../panic.ts";

import { Scope } from "../dst.ts";

import VariableDef from "./variable.ts";
import FunctionDef from "./function.ts";
import StructDef from "./struct.ts";

export default class Void implements Type, Lowerable, Scope {
  readonly safety: Lang.Safety = Lang.Safety.THREADSAFE;

  lookup(
    _id: string | AST.Node,
  ): VariableDef | FunctionDef | StructDef | undefined {
    return undefined;
  }

  find(_id: string | AST.Node): VariableDef | FunctionDef | StructDef {
    throw new Panic("The void doesn't contain anything");
  }

  store(_entity: VariableDef | StructDef | FunctionDef): typeof _entity {
    throw new Error("Can't store anything in the void");
  }

  unit(): Unit {
    throw new Error("Method not implemented.");
  }

  async lower(output: BufWriter, _env: any) {
    await output.write(stringToBytes(`void`));
  }

  name(): string {
    return "void";
  }

  scopeId(): string {
    return "";
  }
}
