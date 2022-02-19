import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";
import { Identifiable, Lowerable, Type } from "../dst.ts";
import { enumFromStringValue, stringToBytes } from "../util.ts";
import * as GenAST from "../ast.ts";
import * as AST from "./ast.ts";
import * as Lang from "./lang.ts";
import Panic from "../panic.ts";

export interface Scope {
  lookup(id: GenAST.Node): TypeRef | Function | undefined;
  find(id: GenAST.Node): TypeRef | Function;
  ensureNot(id: GenAST.Node): void;
  store(entity: Function): typeof entity;
}

export class TypeRef implements Lowerable, Type, Identifiable {
  readonly astNode: GenAST.Node;

  constructor(astNode: GenAST.Node) {
    this.astNode = astNode;
  }

  async lower(output: BufWriter) {
    let zigType: string;
    const builtin = enumFromStringValue(Lang.BuiltinType, this.id());

    switch (builtin) {
      case Lang.BuiltinType.NORETURN:
        zigType = "noreturn";
        break;
      case Lang.BuiltinType.INT:
        zigType = "c_int";
        break;
      default:
        throw Error(`Can not lower C type \`${this.id}\` to Zig`);
    }

    await output.write(stringToBytes(zigType));
  }

  name(): string {
    return this.id();
  }

  idNode(): GenAST.Node {
    return this.astNode;
  }

  id(): string {
    return this.idNode().text;
  }

  inferType(_scope: any): Type {
    return this;
  }
}

export class Function implements Lowerable, Identifiable {
  readonly astNode: AST.Prototype;
  readonly returned: TypeRef;
  readonly args: TypeRef[];

  constructor(
    astNode: AST.Prototype,
    returned: TypeRef,
    args: TypeRef[],
  ) {
    this.astNode = astNode;
    this.returned = returned;
    this.args = args;
  }

  idNode(): GenAST.Node {
    return this.astNode.id;
  }

  id(): string {
    return this.idNode().text;
  }

  inferType(_scope: any): Type {
    return this.returned;
  }

  public async lower(output: BufWriter) {
    await output.write(stringToBytes(`pub extern "c" fn ${this.id()}(`));

    let first = true;
    for (const arg of this.args) {
      if (first) first = false;
      else await output.write(stringToBytes(`, `));
      arg.lower(output);
    }

    await output.write(stringToBytes(`) `));
    await this.returned.lower(output);
    await output.write(stringToBytes(`;`));
  }

  inferReturnType(): Type {
    return this.returned;
  }
}

export class TopLevel implements Scope {
  readonly prototypes = new Map<string, Function>();
  readonly builtinTypes = new Map<string, TypeRef>();

  lookup(id: GenAST.Node): TypeRef | Function | undefined {
    switch (id.text) {
      case "_Noreturn":
      case "int":
        return new TypeRef(id);
      default:
        return this.prototypes.get(id.text);
    }
  }

  find(id: GenAST.Node): TypeRef | Function {
    const found = this.lookup(id);
    if (!found) throw new Panic(`Undeclared C id \`${id.text}\``, id.location);
    else return found;
  }

  ensureNot(id: GenAST.Node): void {
    const found = this.lookup(id);

    if (found) {
      throw new Panic(`Already declared C id \`${id.text}\``, id.location);
    }
  }

  store(entity: Function): typeof entity {
    this.ensureNot(entity.astNode.id);
    this.prototypes.set(entity.id(), entity);
    return entity;
  }
}

export enum TypeComparisonResult {
  DIFFERENT = 0,
  EXACT = 1,
}

export function compareTypes(a: Type, b: Type): TypeComparisonResult {
  if (a instanceof TypeRef && b instanceof TypeRef) {
    if (a.id == b.id) return TypeComparisonResult.EXACT;
  }

  return TypeComparisonResult.DIFFERENT;
}
