import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";
import * as Lang from "./lang.ts";
import * as AST from "../ast.ts";
import * as OnyxAST from "./ast.ts";
import * as CDST from "../c/dst.ts";
import { Identifiable, Lowerable, Type } from "../dst.ts";
import { stringToBytes } from "../util.ts";
import Unit from "../unit.ts";
import Panic from "../panic.ts";

type Directive = Extern;
type Declaration = VariableDef | FunctionDef | StructDef;
type Statement = If;
type Instruction = Return;
type Literal = IntLiteral;
type Expression = Declaration | Statement | Instruction | RuntimeValue;

export class Void implements Type, Lowerable, Scope {
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
    id: AST.Node | string,
  ): VariableDef | StructDef | FunctionDef | undefined;
  find(id: AST.Node | string): VariableDef | StructDef | FunctionDef;
  store(
    entity: VariableDef | StructDef | FunctionDef | Expression,
  ): typeof entity;
}

export interface Mappable<T> {
  readonly astNode: T;
}

export class Ref
  implements
    Identifiable,
    RuntimeValue,
    Mappable<OnyxAST.ID | OnyxAST.CID | OnyxAST.Query | undefined> {
  readonly astNode: OnyxAST.ID | OnyxAST.CID | OnyxAST.Query;
  readonly target:
    | VariableDef
    | FunctionDef
    | StructDef
    | CDST.Function
    | CDST.TypeRef;

  constructor(
    astNode: OnyxAST.ID | OnyxAST.CID | OnyxAST.Query,
    target:
      | VariableDef
      | FunctionDef
      | StructDef
      | CDST.Function
      | CDST.TypeRef,
  ) {
    this.astNode = astNode;
    this.target = target;
  }

  inferType(scope: Scope): Type {
    if (
      this.target instanceof FunctionDef || this.target instanceof CDST.Function
    ) {
      return this.target.inferReturnType(scope);
    } else if (this.target instanceof VariableDef) {
      return this.target.inferType(scope);
    } else {
      return this.target;
    }
  }

  async lower(output: BufWriter, _env: any) {
    if (this.target instanceof StructDef) {
      switch (this.target.builtin) {
        case BuiltinStruct.Bool:
          await output.write(stringToBytes(`bool`));
          return;
        case BuiltinStruct.Int32:
          await output.write(stringToBytes(`i32`));
          return;
      }
    }

    await output.write(stringToBytes(this.target.id));
  }

  idNode(): AST.Node {
    return this.target.idNode();
  }
}

export class Extern implements Lowerable, Mappable<OnyxAST.Extern> {
  readonly astNode: OnyxAST.Extern;
  readonly proto: CDST.Function;

  constructor(astNode: OnyxAST.Extern, proto: CDST.Function) {
    this.astNode = astNode;
    this.proto = proto;
  }

  async lower(output: BufWriter, _env: any) {
    await this.proto.lower(output);
    await output.write(stringToBytes("\n"));
  }
}

export enum BuiltinStruct {
  Bool = "Bool",
  Int32 = "Int32",
}

export class StructDef
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

export enum BuiltinFunction {
  "Bool::!(Bool): Bool",
  "Int32::-(Int32, Int32): Int32",
  "Int32::+(Int32, Int32): Int32",
  "Int32::<(Int32, Int32): Bool",
  "Int32::<=(Int32, Int32): Bool",
  "Int32::eq?(Int32, Int32): Bool",
}

export class FunctionDef implements Identifiable, Mappable<OnyxAST.Def> {
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

export class VariableDef
  implements Lowerable, Identifiable, Mappable<OnyxAST.Final | OnyxAST.DefArg> {
  readonly astNode: OnyxAST.Final | OnyxAST.DefArg;
  readonly id: string;
  readonly type: Ref;
  readonly value?: Expression;

  constructor(
    astNode: OnyxAST.Final | OnyxAST.DefArg,
    id: string,
    type: Ref,
    value?: Expression,
  ) {
    this.astNode = astNode;
    this.id = id;
    this.type = type;
    this.value = value;
  }

  idNode(): AST.Node {
    return this.astNode.id;
  }

  async lower(output: BufWriter, env: any) {
    if (this.astNode instanceof OnyxAST.DefArg) {
      await output.write(stringToBytes(`${this.id}: `));
    } else {
      await output.write(stringToBytes(`const ${this.id}: `));
    }

    await this.type.lower(output, env);

    if (this.value) {
      await output.write(stringToBytes(` = `));
      await this.value.lower(output, env);
    }
  }

  inferType(scope: Scope): Type {
    return this.type.inferType(scope);
  }
}

export class Call
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

export class Case implements RuntimeValue, Mappable<OnyxAST.Case> {
  readonly astNode: OnyxAST.Case;
  readonly cond: RuntimeValue;
  readonly body: Block | RuntimeValue;

  constructor(
    astNode: OnyxAST.Case,
    cond: RuntimeValue,
    body: Block | RuntimeValue,
  ) {
    this.astNode = astNode;
    this.cond = cond;
    this.body = body;
  }

  async lower(output: BufWriter, env: any) {
    await output.write(stringToBytes(`(`));
    await this.cond.lower(output, env);

    if (this.body instanceof Block) {
      await output.write(stringToBytes(`) {\n`));
      await this.body.lower(output, env);
      await output.write(stringToBytes(`;\n}`));
    } else {
      await output.write(stringToBytes(`) { `));
      await this.body.lower(output, env);
      await output.write(stringToBytes(`; }\n`));
    }
  }

  inferType(scope: Scope): Type {
    return this.body.inferType(scope);
  }
}

export class If implements Lowerable, RuntimeValue, Mappable<OnyxAST.If> {
  readonly astNode: OnyxAST.If;
  readonly self: Case;
  readonly elifs: Case[];
  readonly else?: Block | RuntimeValue;

  constructor(
    astNode: OnyxAST.If,
    self: Case,
    elifs: Case[],
    _else?: Block | RuntimeValue,
  ) {
    this.astNode = astNode;
    this.self = self;
    this.elifs = elifs;
    this.else = _else;
  }

  async lower(output: BufWriter, env: any) {
    await output.write(stringToBytes(`if `));
    await this.self.lower(output, env);

    for (const elif of this.elifs) {
      await output.write(stringToBytes(`else if `));
      await elif.lower(output, env);
    }

    if (this.else) {
      if (this.else instanceof Block) {
        await output.write(stringToBytes(`else {\n`));
        await this.else.lower(output, env);
        await output.write(stringToBytes(`;\n}`));
      } else {
        await output.write(stringToBytes(`else { `));
        await this.else.lower(output, env);
        await output.write(stringToBytes(`; }\n`));
      }
    }
  }

  inferType(scope: Scope): Type {
    const result = new Variant([
      this.self.inferType(scope),
      ...this.elifs.map((cases) => cases.inferType(scope)),
    ]);

    if (this.else) result.types.push(this.else.inferType(scope));
    return result.normalize();
  }
}

export class Block
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

export class Variant
  implements RuntimeValue, Lowerable, Type, Scope, Mappable<undefined> {
  readonly astNode: undefined;
  readonly safety = Lang.Safety.THREADSAFE;
  readonly types: Type[];

  constructor(types: Type[]) {
    this.types = types;
  }

  unit(): Unit {
    throw new Error("Method not implemented.");
  }

  lookup(
    _id: string | AST.Node,
  ): VariableDef | StructDef | FunctionDef | undefined {
    throw new Error("Method not implemented.");
  }

  find(_id: string | AST.Node): VariableDef | StructDef | FunctionDef {
    throw new Error("Method not implemented.");
  }

  store(
    _entity: VariableDef | StructDef | FunctionDef,
  ): VariableDef | StructDef | FunctionDef {
    throw new Error("Method not implemented.");
  }

  normalize(): Variant {
    const types = [...new Set(this.types.flat(1))];
    types.sort(compareTypes);
    return new Variant(types);
  }

  inferType(_scope: Scope): Type {
    const normalized = this.normalize();
    if (normalized.types.length == 1) return normalized.types[0];
    else return normalized;
  }

  lower(_output: BufWriter, _env: any): Promise<void> {
    throw new Error("Method not implemented.");
  }

  name(): string {
    return `Variant<\`${this.types.map((t) => t.name()).join(", ")}\`>`;
  }

  scopeId(): string {
    return "";
  }
}

export function compareTypes(_a: Type, _b: Type): number {
  return 0; // TODO:
}

export class Return
  implements Lowerable, RuntimeValue, Mappable<OnyxAST.Return> {
  readonly astNode: OnyxAST.Return;
  readonly value?: RuntimeValue;

  constructor(astNode: OnyxAST.Return, value?: RuntimeValue) {
    this.astNode = astNode;
    this.value = value;
  }

  async lower(output: BufWriter, env: any) {
    await output.write(stringToBytes(`return `));
    await (this.value ? this.value.lower(output, env) : `void`);
  }

  inferType(scope: Scope): Type {
    return this.value ? this.value.inferType(scope) : UNIVERSE.Void;
  }
}

export class IntLiteral
  implements Lowerable, RuntimeValue, Mappable<OnyxAST.IntLiteral> {
  readonly astNode: OnyxAST.IntLiteral;
  readonly value: number;

  constructor(astNode: OnyxAST.IntLiteral, value: number) {
    this.astNode = astNode;
    this.value = value;
  }

  async lower(output: BufWriter, _env: any) {
    await output.write(stringToBytes(`${this.value}`));
  }

  inferType(scope: Scope): StructDef {
    const found = scope.find("Int32");

    if (!found) {
      throw new Panic(
        "Can't find builtin struct `Int32`",
        this.astNode.location,
      );
    }

    if (!(found instanceof StructDef)) {
      throw new Panic("Unexpected type for `Int32`", this.astNode.location);
    }

    return found;
  }
}

export class TopLevel implements Lowerable, Scope {
  readonly safety = Lang.Safety.FRAGILE;

  readonly externs = new Array<Extern>();
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
  ): VariableDef | FunctionDef | StructDef | undefined {
    const text = id instanceof AST.Node ? id.text : id;
    let found: VariableDef | FunctionDef | StructDef | undefined;

    found = this.structs.get(text);
    if (found) return found;

    found = this.functions.get(text);
    if (found) return found;

    found = this.variables.get(text);
    if (found) return found;
  }

  find(id: AST.Node | string): VariableDef | FunctionDef | StructDef {
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
    if (entity instanceof VariableDef) this.variables.set(entity.id, entity);
    else if (entity instanceof StructDef) this.structs.set(entity.id, entity);
    else if (entity instanceof FunctionDef) {
      this.functions.set(entity.id, entity);
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
      await output.write(stringToBytes(`\n`));
    }

    await output.write(stringToBytes(`}`));
  }
}
