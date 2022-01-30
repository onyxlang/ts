import { BufWriter } from "https://deno.land/std@0.123.0/io/buffer.ts";
import { Node } from "../ast.ts";
import * as CST from "./cst.ts";
import { stringToBytes } from "../util.ts";
import Program from "../program.ts";
import * as Lang from "./lang.ts";
import Panic, { Note } from "../panic.ts";

/**
 * A builtin type node, e.g. `char*`.
 */
export class BuiltinType implements Node {
  cstNode: CST.TypeRef;
  kind: Lang.BuiltinType;
  pointerDepth: number;

  constructor(
    cstNode: CST.TypeRef,
    kind: Lang.BuiltinType,
    pointerDepth: number = 0,
  ) {
    this.cstNode = cstNode;
    this.kind = kind;
    this.pointerDepth = pointerDepth;
  }

  async lower(
    output: BufWriter,
    context: { constMod: boolean } = { constMod: false },
  ) {
    let zigType: string;

    switch (this.kind) {
      case Lang.BuiltinType.Noreturn:
        zigType = "noreturn";
        break;
      case Lang.BuiltinType.Void:
        zigType = "void";
        break;
      case Lang.BuiltinType.Int:
        zigType = "c_int";
        break;
      case Lang.BuiltinType.Char:
        zigType = "u8";
        break;
      default:
        throw Error(`Can not lower C type \`${this.kind}\` to Zig`);
    }

    if (context?.constMod) {
      zigType = `const ${zigType}`;
    }

    if (this.pointerDepth) {
      // TODO: Multi-depth pointers?
      zigType = "[*c]" + zigType;
    }

    await output.write(stringToBytes(zigType));
  }
}

/**
 * A compiled C function prototype argument node,
 * e.g. `const char*` in `void puts(const char*);`
 */
export class ProtoArg implements Node {
  cstNode: CST.ArgDecl;
  type: BuiltinType;

  constructor(cstNode: CST.ArgDecl, type: BuiltinType) {
    this.cstNode = cstNode;
    this.type = type;
  }

  id(): string | undefined {
    return this.cstNode.id?.raw;
  }

  constMod(): boolean {
    return !!this.cstNode.constKeyword;
  }

  async lower(output: BufWriter, _context?: any) {
    const id = this.id();
    if (id) await output.write(stringToBytes(id + ": "));

    await this.type.lower(output, { constMod: this.constMod() });
  }
}

/**
 * A compiled C function prototype node, e.g. `void puts(const char*);`.
 */
export class Proto implements Node {
  cstNode: CST.Proto;
  returnType: BuiltinType;
  args: ProtoArg[];
  argsMap: Map<string, { index: number; node: ProtoArg }>;

  static compile(program: Program, cstNode: CST.Proto): Proto {
    const returnType = program.resolveCTypeRef(cstNode.returnType);
    program.ensureCIDFree(cstNode.id);

    const args = new Array<ProtoArg>();
    const argsMap = new Map<string, { index: number; node: ProtoArg }>();

    for (const argCSTNode of cstNode.args.args) {
      const type = program.resolveCTypeRef(argCSTNode.type);
      const arg = new ProtoArg(argCSTNode, type);

      if (argCSTNode.id) {
        const declared = argsMap.get(argCSTNode.id.raw);

        if (declared) {
          throw new Panic(
            `Already declared argument with id \`${argCSTNode.id.raw}\``,
            argCSTNode.id.loc(),
            [
              new Note(
                "Previously declared here",
                declared.node.cstNode.id!.loc(),
              ),
            ],
          );
        } else {
          argsMap.set(argCSTNode.id.raw, { index: args.length, node: arg });
        }
      }

      args.push(arg);
    }

    return new Proto(cstNode, returnType, args, argsMap);
  }

  private constructor(
    cstNode: CST.Proto,
    returnType: BuiltinType,
    args: ProtoArg[],
    argsMap: Map<string, { index: number; node: ProtoArg }>,
  ) {
    this.cstNode = cstNode;
    this.returnType = returnType;
    this.args = args;
    this.argsMap = argsMap;
  }

  id(): string {
    return this.cstNode.id.raw;
  }

  async lower(output: BufWriter, _context?: any) {
    await output.write(stringToBytes(`pub extern "c" fn ${this.id()}`));
    await output.write(CST.poly.PunctBytes.openParen);

    let first = true;
    for (const arg of this.args) {
      if (first) first = false;
      else await output.write(CST.poly.PunctBytes.commaSpace);
      await arg.lower(output);
    }

    await output.write(CST.poly.PunctBytes.closeParen);
    await output.write(CST.poly.PunctBytes.space);
    await this.returnType.lower(output);
    await output.write(CST.poly.PunctBytes.semi);
  }
}

export class Root implements Node {
  children = new Array<Proto>();

  async lower(output: BufWriter, _context?: any) {
    for (const child of this.children) {
      await child.lower(output);
    }
  }
}
