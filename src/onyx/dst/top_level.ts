import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import { Expression, Import, UNIVERSE, Void } from "../dst.ts";
import * as CDST from "../../c/dst.ts";
import { Identifiable, Lowerable } from "../../dst.ts";
import { stringToBytes } from "../../util.ts";
import Unit from "../../unit.ts";
import Panic from "../../panic.ts";

import { Scope } from "../dst.ts";

import Extern from "./extern.ts";
import Call from "./call.ts";
import StructDef from "./struct.ts";
import VariableDef from "./variable.ts";
import FunctionDef from "../dst/function.ts";

export default class TopLevel implements Lowerable, Scope {
  readonly safety = Lang.Safety.FRAGILE;

  readonly externs = new Array<Extern>();
  readonly imports = new Array<Import>();
  private readonly structs = new Map<string, StructDef>();
  private readonly functions = new Map<string, FunctionDef>();
  private readonly variables = new Map<string, VariableDef>();
  private readonly expressions = new Array<Expression>();
  private readonly _unit: Unit;

  constructor(unit: Unit) {
    this._unit = unit;
  }

  unit(): Unit {
    return this._unit;
  }

  lookup(
    id: AST.Node | string,
  ): Identifiable | Void | undefined {
    const text = id instanceof AST.Node ? id.text : id;
    if (text == "void") return UNIVERSE.Void;

    let found: Identifiable | undefined;

    found = this._unit.imports.get(text);
    if (found) return found;

    found = this.structs.get(text);
    if (found) return found;

    found = this.functions.get(text);
    if (found) return found;

    found = this.variables.get(text);
    if (found) return found;
  }

  find(id: AST.Node | string): Identifiable | Void {
    const text = id instanceof AST.Node ? id.text : id;
    const found = this.lookup(id);

    if (!found) {
      throw new Panic(
        `Undeclared \`${text}\``,
        id instanceof AST.Node ? id.location : undefined,
      );
    } else {
      return found;
    }
  }

  store(
    entity: VariableDef | StructDef | FunctionDef | Expression,
  ): typeof entity {
    if (entity instanceof VariableDef) this.variables.set(entity.id(), entity);
    else if (entity instanceof StructDef) this.structs.set(entity.id(), entity);
    else if (entity instanceof FunctionDef) {
      this.functions.set(entity.id(), entity);
    } else this.expressions.push(entity);

    return entity;
  }

  cDST(): CDST.Scope {
    return this._unit.program.cDST;
  }

  scopeId(): string {
    return "";
  }

  async lower(
    output: BufWriter,
    env: { safety: Lang.Safety } = { safety: Lang.Safety.FRAGILE },
  ) {
    for (const _import of this.imports) {
      await _import.lower(output, env);
      await output.write(stringToBytes(`\n`));
    }

    for (const extern of this.externs) {
      await extern.lower(output, env);
      await output.write(stringToBytes(`\n`));
    }

    for (const [_id, struct] of this.structs) {
      await struct.lower(output, env);
      // await output.write(stringToBytes(`\n`));
    }

    for (const [_id, func] of this.functions) {
      await func.lower(output, env);
      await output.write(stringToBytes(`\n`));
    }

    for (const [_id, variable] of this.variables) {
      await variable.lower(output, env);
      await output.write(stringToBytes(`;\n`));
    }

    await output.write(stringToBytes(`pub fn main() void {\n`));

    for (const expr of this.expressions) {
      await expr.lower(output, env);
      if (expr instanceof Call) await output.write(stringToBytes(`;`));
      await output.write(stringToBytes(`\n`));
    }

    await output.write(stringToBytes(`}`));
  }
}
