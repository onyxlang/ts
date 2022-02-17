import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as Lang from "../lang.ts";
import * as AST from "../../ast.ts";
import * as OnyxAST from "../ast.ts";
import { Expression, UNIVERSE } from "../dst.ts";
import { Lowerable, Type } from "../../dst.ts";
import Unit from "../../unit.ts";
import Panic from "../../panic.ts";

import { Mappable, RuntimeValue, Scope } from "../dst.ts";

import StructDef from "./struct.ts";
import VariableDef from "./variable.ts";
import FunctionDef from "../dst/function.ts";

export default class Block
  implements
    Lowerable,
    Scope,
    RuntimeValue,
    Mappable<OnyxAST.Block | undefined> {
  /** Will be undefined for a virtual block. */
  readonly astNode: OnyxAST.Block | undefined;

  readonly parent: Scope;
  readonly semanticScope?: FunctionDef;
  readonly safety: Lang.Safety;
  readonly body: Expression[] = [];

  private readonly variables = new Map<string, VariableDef>();
  private readonly functions = new Map<string, FunctionDef>();
  private readonly structs = new Map<string, StructDef>();

  constructor(
    astNode: OnyxAST.Block | undefined,
    syntaxScope: Scope,
    safety: Lang.Safety,
    semanticScope?: FunctionDef,
  ) {
    this.astNode = astNode;
    this.parent = syntaxScope;
    this.safety = safety;
    this.semanticScope = semanticScope;
  }

  lookup(
    id: AST.Node | string,
  ): FunctionDef | StructDef | VariableDef | undefined {
    let found: FunctionDef | StructDef | VariableDef | undefined;
    const text = id instanceof AST.Node ? id.text : id;

    if (this.semanticScope) {
      found = this.semanticScope.args.get(text);
      if (found) return found;
    }

    found = this.variables.get(text);
    if (found) return found;

    found = this.functions.get(text);
    if (found) return found;

    found = this.structs.get(text);
    if (found) return found;

    if (!found) return this.parent.lookup(id);
    else return found;
  }

  find(id: AST.Node | string): FunctionDef | StructDef | VariableDef {
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
    else this.body.push(entity);
    return entity;
  }

  /** A block simply yields its expressions without wrapping brackets. */
  async lower(output: BufWriter, env: any) {
    for (const expr of this.body) {
      await expr.lower(output, env);
    }
  }

  unit(): Unit {
    return this.parent!.unit();
  }

  scopeId(): string {
    return "";
  }

  inferType(scope: Scope): Type {
    if (this.body.length == 0) return UNIVERSE.Void;
    else {
      const last = this.body[this.body.length - 1];

      if (last instanceof StructDef || last instanceof FunctionDef) {
        return UNIVERSE.Void;
      } else {
        return last.inferType(scope);
      }
    }
  }
}
