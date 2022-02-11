// @deno-types="https://raw.githubusercontent.com/onyxlang/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/onyxlang/peggy/cjs-to-es15/lib/peg.js";

import * as BufferAPI from "https://deno.land/std@0.123.0/io/buffer.ts";
import * as CST from "../cst.ts";
import { stringToBytes } from "../util.ts";
import { Keyword as KeywordEnum } from "./lang.ts";

export { CST as poly };

/**
 * A keyword token.
 */
export class Keyword extends CST.Token {
  keyword: KeywordEnum;

  constructor(
    loc: peggy.LocationRange,
    raw: string,
    keyword: KeywordEnum,
  ) {
    super(loc, raw);
    this.keyword = keyword;
  }
}

export class ID extends CST.Token {
  constructor(loc: peggy.LocationRange, raw: string) {
    super(loc, raw);
  }
}

/**
 * A C type reference node, e.g. `unsigned int*`.
 *
 * FIXME: `const` modifier shall belong to a type.
 */
export class TypeRef implements CST.Node {
  id: ID;
  pointerDepth: number = 0;

  constructor({ id, pointerDepth = 0 }: { id: ID; pointerDepth: number }) {
    this.id = id;
    this.pointerDepth = pointerDepth;
  }

  loc() {
    // TODO: Also consider pointer depth.
    return this.id.loc();
  }

  async print(output: BufferAPI.BufWriter, indent: number = 0): Promise<void> {
    await CST.tab(output, indent);

    await output.write(
      stringToBytes(this.id.raw + "*".repeat(this.pointerDepth)),
    );
  }
}

/**
 * A C argument declaration node.
 */
export class ArgDecl implements CST.Node {
  constKeyword?: Keyword;
  type: TypeRef;
  id?: ID;

  constructor(
    { constKeyword, type, id }: {
      constKeyword?: Keyword;
      type: TypeRef;
      id?: ID;
    },
  ) {
    this.constKeyword = constKeyword;
    this.type = type;
    this.id = id;
  }

  loc() {
    const ranges = [this.type.loc()];

    if (this.constKeyword) {
      ranges.unshift(this.constKeyword.loc());
    }

    if (this.id) {
      ranges.push(this.id.loc());
    }

    return CST.joinLocRange(ranges);
  }

  async print(output: BufferAPI.BufWriter, indent: number = 0): Promise<void> {
    await CST.tab(output, indent);

    if (this.constKeyword) {
      await this.constKeyword.print(output);
      await output.write(CST.PunctBytes.space);
    }

    await this.type.print(output);

    if (this.id) {
      await output.write(CST.PunctBytes.space);
      await this.id.print(output);
    }
  }
}

/**
 * A function prototype arguments declaration.
 */
export class ProtoArgsDecl implements CST.Node {
  location: peggy.LocationRange;
  multiline: boolean;
  args: ArgDecl[];

  constructor({ location, multiline, args }: {
    location: peggy.LocationRange;
    multiline: boolean;
    args: ArgDecl[];
  }) {
    this.location = location;
    this.multiline = multiline;
    this.args = args;
  }

  loc() {
    return this.location;
  }

  async print(output: BufferAPI.BufWriter, _indent: number = 0): Promise<void> {
    await output.write(CST.PunctBytes.openParen);

    if (this.multiline) {
      await output.write(CST.PunctBytes.newline);
    }

    let first = true;
    for (const arg of this.args) {
      if (first) first = false;
      else {
        output.write(
          this.multiline ? CST.PunctBytes.comma : CST.PunctBytes.commaSpace,
        );
      }

      await arg.print(output);
    }

    await output.write(CST.PunctBytes.closeParen);
  }
}

/**
 * A C function prototype.
 */
export class Proto implements CST.Node {
  returnType: TypeRef;
  id: ID;
  args: ProtoArgsDecl;

  constructor(
    { returnType, id, args }: {
      id: ID;
      args: ProtoArgsDecl;
      returnType: TypeRef;
    },
  ) {
    this.id = id;
    this.args = args;
    this.returnType = returnType;
  }

  loc() {
    return CST.joinLocRange([
      this.id.loc(),
      this.returnType.loc(),
      this.args.loc(),
    ]);
  }

  async print(output: BufferAPI.BufWriter, indent: number = 0): Promise<void> {
    await CST.tab(output, indent);

    await this.returnType.print(output);
    await output.write(CST.PunctBytes.space);

    await this.id.print(output);
    await this.args.print(output);

    await output.write(CST.PunctBytes.semi);
  }
}
