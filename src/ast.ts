import { stringToBytes } from "./util.ts";

export interface Node {
  lowerToZig(file: Deno.File, options?: any): Promise<void>;
}

export async function zigMain(file: Deno.File, callback: () => any) {
  await file.write(stringToBytes("pub fn main() void {\n"));
  await callback();
  await file.write(stringToBytes("}"));
}

export class CType implements Node {
  type: string;
  pointerDepth: number = 0;

  constructor(type: string, pointerDepth: number = 0) {
    this.type = type;
    this.pointerDepth = pointerDepth;
  }

  async lowerToZig(file: Deno.File, options?: { const_mod: boolean }) {
    let zigType: string;

    switch (this.type) {
      case "short":
        zigType = "c_short";
        break;
      case "unsigned short":
        zigType = "c_ushort";
        break;
      case "int":
        zigType = "c_int";
        break;
      case "unsigned int":
        zigType = "c_uint";
        break;
      case "long":
        zigType = "c_long";
        break;
      case "unsigned long":
        zigType = "c_ulong";
        break;
      case "long long":
        zigType = "c_longlong";
        break;
      case "unsigned long long":
        zigType = "c_ulonglong";
        break;
      case "long double":
        zigType = "c_longdouble";
        break;
      case "void":
        zigType = "void";
        break;
      case "char":
        zigType = "u8";
        break;
      default:
        throw Error(`Can not lower C type \`${this.type}\` to Zig`);
    }

    if (options?.const_mod) {
      zigType = `const ${zigType}`;
    }

    if (this.pointerDepth) {
      // TODO: Multi-depth pointers?
      zigType = "[*c]" + zigType;
    }

    await file.write(stringToBytes(zigType));
  }
}

/**
 * A C prototype argument.
 */
export class CProtoArg implements Node {
  const_mod: boolean;
  type: CType;
  id: string;

  constructor(const_mod: boolean, type: CType, id: string) {
    this.const_mod = const_mod;
    this.type = type;
    this.id = id;
  }

  async lowerToZig(file: Deno.File) {
    if (this.id) await file.write(stringToBytes(this.id + ": "));
    await this.type.lowerToZig(file, { const_mod: this.const_mod });
  }
}

/**
 * A C function prototype.
 *
 * @example void printf(char*, ...);
 */
export class CProto implements Node {
  id: string;
  args: CProtoArg[];
  return_type: CType;

  constructor(id: string, args: CProtoArg[], return_type: CType) {
    this.id = id;
    this.args = args;
    this.return_type = return_type;
  }

  async lowerToZig(file: Deno.File) {
    await file.write(stringToBytes(`pub extern "c" fn ${this.id}(`));

    let first = true;
    for (const arg of this.args) {
      if (first) first = false;
      else await file.write(stringToBytes(", "));
      await arg.lowerToZig(file);
    }

    await file.write(stringToBytes(") "));
    await this.return_type.lowerToZig(file);
    await file.write(stringToBytes(";"));
  }
}

export class Extern implements Node {
  c_proto: CProto;

  constructor(c_proto: CProto) {
    this.c_proto = c_proto;
  }

  async lowerToZig(file: Deno.File) {
    await this.c_proto.lowerToZig(file);
    await file.write(stringToBytes("\n"));
  }
}

export enum Safety {
  UNSAFE = "unsafe",
  FRAGILE = "fragile",
  THREADSAFE = "threadsafe",
}

export class FFIStringLiteral implements Node {
  value: string;

  constructor(value: string) {
    this.value = value;
  }

  async lowerToZig(file: Deno.File) {
    await file.write(stringToBytes(`"${this.value}"`));
  }
}

export class FFIProtoRef implements Node {
  id: string;

  constructor(id: string) {
    this.id = id;
  }

  async lowerToZig(file: Deno.File) {
    await file.write(stringToBytes(this.id));
  }
}

export class FFICall implements Node {
  callee: FFIProtoRef;
  args: RVal[];

  constructor(callee: FFIProtoRef, args: RVal[]) {
    this.callee = callee;
    this.args = args;
  }

  async lowerToZig(file: Deno.File) {
    await this.callee.lowerToZig(file);
    await file.write(stringToBytes("("));

    let first = true;
    for (const arg of this.args) {
      if (first) first = false;
      else await file.write(stringToBytes(", "));
      await arg.lowerToZig(file);
    }

    await file.write(stringToBytes(");"));
  }
}

export type Expr = FFICall;
export type RVal = Expr | FFIStringLiteral;

export class SafetyStatement implements Node {
  safety: Safety;
  exprs: Expr[];

  constructor(safety: Safety, exprs: Expr[]) {
    this.safety = safety;
    this.exprs = exprs;
  }

  async lowerToZig(file: Deno.File) {
    for (const expr of this.exprs) {
      await expr.lowerToZig(file);
      await file.write(stringToBytes("\n"));
    }
  }
}

export class Tuple implements Node {
  elements: RVal[];

  constructor(elements: RVal[]) {
    this.elements = elements;
  }

  async lowerToZig(file: Deno.File) {
    await file.write(stringToBytes("("));

    let first = true;
    for (const el of this.elements) {
      if (first) first = false;
      else await file.write(stringToBytes(", "));
      await el.lowerToZig(file);
    }

    await file.write(stringToBytes(")"));
  }
}

export type Root = (Extern | SafetyStatement)[];
