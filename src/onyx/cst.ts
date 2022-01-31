// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import * as BufferAPI from "https://deno.land/std@0.123.0/io/buffer.ts";

import * as CST from "../cst.ts";
import * as CCST from "../c/cst.ts";
import { FuncAction, Keyword as KeywordEnum, Safety } from "./lang.ts";
import { stringToBytes } from "../util.ts";

export { CST as poly };

/**
 * A single comment token.
 */
export class Comment extends CST.Token {
  private _value: string;

  constructor(loc: peggy.LocationRange, raw: string, value: string) {
    super(loc, raw);
    this._value = value;
  }

  /**
   * The derived comment value.
   */
  value() {
    return this._value;
  }
}

/**
 * A keyword token.
 */
export class Keyword extends CST.Token {
  keyword: KeywordEnum;

  constructor(loc: peggy.LocationRange, raw: string, keyword: KeywordEnum) {
    super(loc, raw);
    this.keyword = keyword;
  }
}

export enum IDKind {
  /** E.g. `foo`.  */ COMMON,
  /** E.g. `foo:`. */ LABEL,
  /** E.g. `:foo`. */ SYMBOL,
  /** E.g. `$foo`. */ FFI,
}

/**
 * An identifier token.
 */
export class ID extends CST.Token {
  kind: IDKind;
  wrapped: boolean;
  value: string;

  constructor(
    loc: peggy.LocationRange,
    raw: string,
    {
      kind,
      wrapped,
      value,
    }: {
      kind: IDKind;
      wrapped: boolean;
      value: string;
    },
  ) {
    super(loc, raw);
    this.kind = kind;
    this.wrapped = wrapped;
    this.value = value;
  }
}

/**
 * An FFI string literal token, e.g. `$"Hello world!"`.
 */
export class FFIStringLiteral extends CST.Token {
  /** The derived string literal value, e.g. `"Hello world!"`. */
  value: string;

  constructor(
    loc: peggy.LocationRange,
    raw: string,
    { value }: { value: string },
  ) {
    super(loc, raw);
    this.value = value;
  }
}

/**
 * An integer literal token, e.g. `42`.
 */
export class IntLiteral extends CST.Token {}

/**
 * An `extern` directive node.
 */
export class Extern implements CST.Node {
  keyword: Keyword;
  value: CCST.Proto;

  constructor({ keyword, value }: { keyword: Keyword; value: CCST.Proto }) {
    this.keyword = keyword;
    this.value = value;
  }

  loc() {
    return CST.joinLocRange([this.keyword.loc(), this.value.loc()]);
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    if (indentFirst) await CST.tab(output, indent);
    await output.write(stringToBytes("extern "));
    await this.value.print(output);
  }
}

/**
 * An explicit safety statement node.
 */
export class ExplicitSafetyStatement implements CST.Node {
  keyword: Keyword;
  content: Expr;

  constructor({ keyword, content }: { keyword: Keyword; content: Expr }) {
    this.keyword = keyword;
    this.content = content;
  }

  safety() {
    switch (this.keyword.keyword) {
      case KeywordEnum.UNSAFE_BANG:
        return Safety.UNSAFE;
      case KeywordEnum.FRAGILE_BANG:
        return Safety.FRAGILE;
      case KeywordEnum.THREADSAFE_BANG:
        return Safety.THREADSAFE;
      default:
        throw Error(`BUG: Unrecognized safety keyword \`${this.keyword.raw}\``);
    }
  }

  loc(): peggy.LocationRange {
    return CST.joinLocRange([this.keyword.loc(), this.content.loc()]);
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    if (indentFirst) await CST.tab(output, indent);
    await this.keyword.print(output);
    await output.write(CST.PunctBytes.space);
    await this.content.print(output, indent, false);
  }
}

/**
 * A type pointer suffix, e.g. `*` in `T`.
 */
export class PointerSuffix extends CST.Token {
  async print(output: BufferAPI.BufWriter) {
    await output.write(CST.PunctBytes.asterisk);
  }
}

/**
 * A type identifier reference.
 */
export class TypeRef implements CST.Node {
  id: ID;
  pointerSuffixes: PointerSuffix[];

  constructor(
    { id, pointerSuffixes = [] }: { id: ID; pointerSuffixes: PointerSuffix[] },
  ) {
    this.id = id;
    this.pointerSuffixes = pointerSuffixes;
  }

  loc() {
    const ranges = [this.id.loc()];

    for (const suffix of this.pointerSuffixes) {
      ranges.push(suffix.loc());
    }

    return CST.joinLocRange(ranges);
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    if (indentFirst) await CST.tab(output, indent);
    await this.id.print(output);

    for (const suffix of this.pointerSuffixes) {
      await suffix.print(output);
    }
  }
}

/**
 * A restriction node, e.g. `: T`.
 */
export class Restriction implements CST.Node {
  real?: TypeRef;
  virtual?: TypeRef;

  constructor({ real, virtual }: { real?: TypeRef; virtual?: TypeRef }) {
    this.real = real;
    this.virtual = virtual;
  }

  loc() {
    const ranges = Array<peggy.LocationRange>();

    if (this.real) {
      ranges.push(this.real.loc());
    }

    if (this.virtual) {
      ranges.push(this.virtual.loc());
    }

    return CST.joinLocRange(ranges);
  }

  async print(output: BufferAPI.BufWriter) {
    if (this.real) {
      await output.write(CST.PunctBytes.wrappedColon);
      await this.real.print(output);
    }

    if (this.virtual) {
      await output.write(
        this.real ? CST.PunctBytes.tilde : CST.PunctBytes.wrappedTilde,
      );

      await this.virtual.print(output);
    }
  }
}

/**
 * A variable ion node.
 */
export class VarIon implements CST.Node {
  id: ID;
  restriction?: Restriction;

  constructor({ id, restriction }: { id: ID; restriction?: Restriction }) {
    this.id = id;
    this.restriction = restriction;
  }

  loc() {
    const ranges = [this.id.loc()];

    if (this.restriction) {
      ranges.push(this.restriction.loc());
    }

    return CST.joinLocRange(ranges);
  }

  async print(output: BufferAPI.BufWriter) {
    await this.id.print(output);
    await this.restriction?.print(output);
  }
}

export class FuncArgsDecl implements CST.Node {
  location: peggy.LocationRange;
  multiline: boolean;
  args: VarIon[];

  constructor({
    location,
    multiline,
    args,
  }: {
    location: peggy.LocationRange;
    multiline: boolean;
    args: VarIon[];
  }) {
    this.location = location;
    this.multiline = multiline;
    this.args = args;
  }

  loc() {
    return this.location;
  }

  async print(output: BufferAPI.BufWriter) {
    await output.write(CST.PunctBytes.openParen);

    if (this.multiline) {
      await output.write(CST.PunctBytes.newline);
    }

    let first = true;
    for (const arg of this.args) {
      if (first) first = false;
      else await output.write(CST.PunctBytes.commaSpace);
      await arg.print(output);
    }

    await output.write(CST.PunctBytes.closeParen);
  }
}

/**
 * A function ion node.
 */
export class FuncIon implements CST.Node {
  builtinToken?: Keyword;
  actionToken: Keyword;
  idToken: ID;
  args: FuncArgsDecl;
  restriction?: Restriction;
  body?: Expr;

  constructor({
    builtin,
    action,
    id,
    args,
    restriction,
    body,
  }: {
    builtin?: Keyword;
    action: Keyword;
    id: ID;
    args: FuncArgsDecl;
    restriction?: Restriction;
    body?: Expr;
  }) {
    this.builtinToken = builtin;
    this.actionToken = action;
    this.idToken = id;
    this.args = args;
    this.restriction = restriction;
    this.body = body;
  }

  action(): FuncAction {
    switch (this.actionToken.keyword) {
      case KeywordEnum.DEF:
        return FuncAction.Def;
      default:
        throw Error(`Invalid keyword \`${this.actionToken.keyword}\``);
    }
  }

  loc() {
    const ranges = [this.actionToken.loc(), this.idToken.loc()];

    if (this.builtinToken) {
      ranges.push(this.builtinToken.loc());
    }

    ranges.push(this.args.loc());

    if (this.restriction) {
      ranges.push(this.restriction.loc());
    }

    if (this.body) {
      ranges.push(this.body.loc());
    }

    return CST.joinLocRange(ranges);
  }

  async print(output: BufferAPI.BufWriter, indent: number = 0) {
    await CST.tab(output, indent);

    if (this.builtinToken) {
      await this.builtinToken.print(output);
      await output.write(CST.PunctBytes.space);
    }

    await this.actionToken.print(output);
    await output.write(CST.PunctBytes.space);
    await this.idToken.print(output);
    await this.args.print(output);
    await this.restriction?.print(output);

    if (this.body) {
      if (this.body instanceof Block) {
        await output.write(CST.PunctBytes.space);
        await this.body.print(output, indent, false);
      } else {
        throw new Error("Inline function bodies aren't implemented yet");
      }
    }
  }
}

/**
 * A keyword argument, e.g. `foo: bar`.
 */
export class KWArg implements CST.Node {
  label: ID;
  value: Expr;

  constructor({ label, value }: { label: ID; value: Expr }) {
    this.label = label;
    this.value = value;
  }

  loc() {
    return CST.joinLocRange([this.label.loc(), this.value.loc()]);
  }

  async print(output: BufferAPI.BufWriter) {
    await this.label.print(output);
    await output.write(CST.PunctBytes.space);
    await this.value.print(output);
  }
}

export class CallArgs implements CST.Node {
  location: peggy.LocationRange;
  multiline: boolean;
  args: (Expr | KWArg)[];

  constructor({
    location,
    multiline,
    args,
  }: {
    location: peggy.LocationRange;
    multiline: boolean;
    args: (Expr | KWArg)[];
  }) {
    this.location = location;
    this.multiline = multiline;
    this.args = args;
  }

  loc() {
    return this.location;
  }

  async print(output: BufferAPI.BufWriter) {
    await output.write(CST.PunctBytes.openParen);

    if (this.multiline) {
      await output.write(CST.PunctBytes.newline);
    }

    let first = true;
    for (const arg of this.args) {
      if (first) first = false;
      else {
        await output.write(
          this.multiline ? CST.PunctBytes.comma : CST.PunctBytes.commaSpace,
        );
      }

      await arg.print(output);
    }

    await output.write(CST.PunctBytes.closeParen);
  }
}

/**
 * A function call node.
 */
export class Call implements CST.Node {
  callee: ID;
  args: CallArgs;

  constructor({ callee, args }: { callee: ID; args: CallArgs }) {
    this.callee = callee;
    this.args = args;
  }

  loc() {
    return CST.joinLocRange([this.callee.loc(), this.args.loc()]);
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    await this.callee.print(output, indentFirst ? indent : 0);
    await this.args.print(output);
  }
}

export class Tuple implements CST.Node {
  location: peggy.LocationRange;
  multiline: boolean;
  elements: Expr[];

  constructor(
    { location, multiline, elements }: {
      location: peggy.LocationRange;
      multiline: boolean;
      elements: Expr[];
    },
  ) {
    this.location = location;
    this.multiline = multiline;
    this.elements = elements;
  }

  loc() {
    return this.location;
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    if (indentFirst) await CST.tab(output, indent);
    await output.write(CST.PunctBytes.openParen);

    if (this.multiline) {
      await output.write(CST.PunctBytes.newline);
    }

    let first = true;
    for (const element of this.elements) {
      if (first) {
        first = false;
      } else {
        if (this.multiline) {
          await output.write(CST.PunctBytes.newline);
        } else {
          await output.write(CST.PunctBytes.semi);
          await output.write(CST.PunctBytes.space);
        }
      }

      if (this.multiline) {
        await element.print(output, indent + 1, true);
      } else {
        await element.print(output, indent, false);
      }
    }

    if (this.multiline) {
      await output.write(CST.PunctBytes.newline);
      await CST.tab(output, indent);
    }

    await output.write(CST.PunctBytes.closeParen);
  }
}

/**
 * A block of code.
 */
export class Block implements CST.Node {
  location: peggy.LocationRange;
  multiline: boolean;
  nodes: Any[];

  constructor({
    location,
    multiline,
    exprs,
  }: {
    location: peggy.LocationRange;
    multiline: boolean;
    exprs: Any[];
  }) {
    this.location = location;
    this.nodes = exprs;
    this.multiline = multiline;
  }

  loc() {
    return this.location;
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    if (indentFirst) await CST.tab(output, indent);
    await output.write(CST.PunctBytes.openBracket);

    if (this.multiline) {
      await output.write(CST.PunctBytes.newline);
    }

    let first = true;
    for (const node of this.nodes) {
      if (first) {
        first = false;
      } else {
        if (this.multiline) {
          await output.write(CST.PunctBytes.newline);
        } else {
          await output.write(CST.PunctBytes.semi);
          await output.write(CST.PunctBytes.space);
        }
      }

      if (this.multiline) {
        await node.print(output, indent + 1, true);
      } else {
        await node.print(output, indent, false);
      }
    }

    if (this.multiline) {
      await output.write(CST.PunctBytes.newline);
      await CST.tab(output, indent);
    }

    await output.write(CST.PunctBytes.closeBracket);
  }
}

/**
 * A case branch node, e.g. `if`, `elif` or `case`.
 */
export class Case implements CST.Node {
  caseKeyword: Keyword;
  cond: Expr;
  body: Expr;
  thenKeyword?: Keyword;

  constructor({
    caseKeyword,
    cond,
    body,
    thenKeyword,
  }: {
    caseKeyword: Keyword;
    cond: Expr;
    body: Expr;
    thenKeyword?: Keyword;
  }) {
    this.caseKeyword = caseKeyword;
    this.cond = cond;
    this.body = body;
    this.thenKeyword = thenKeyword;
  }

  loc() {
    const ranges = [this.caseKeyword.loc(), this.cond.loc(), this.body.loc()];

    if (this.thenKeyword) {
      ranges.push(this.thenKeyword.loc());
    }

    return CST.joinLocRange(ranges);
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    if (indentFirst) await CST.tab(output, indent);

    await this.caseKeyword.print(output);
    await output.write(CST.PunctBytes.space);

    await this.cond.print(output, indent, false);
    await output.write(CST.PunctBytes.space);

    if (this.thenKeyword) {
      await this.thenKeyword?.print(output);
      await output.write(CST.PunctBytes.space);
    }

    await this.body.print(output, indent, false);
  }
}

/**
 * An `else` node.
 */
export class Else implements CST.Node {
  keyword: Keyword;
  body: Expr;

  constructor({ keyword, body }: { keyword: Keyword; body: Expr }) {
    this.keyword = keyword;
    this.body = body;
  }

  loc() {
    return CST.joinLocRange([this.keyword.loc(), this.body.loc()]);
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    if (indentFirst) await CST.tab(output, indent);
    await this.keyword.print(output);
    await output.write(CST.PunctBytes.space);
    await this.body.print(output, indent, false);
  }
}

/**
 * An `if` statement node.
 */
export class If implements CST.Node {
  self: Case;
  else?: Else;

  constructor({ self, _else }: { self: Case; _else?: Else }) {
    this.self = self;
    this.else = _else;
  }

  loc(): peggy.LocationRange {
    const ranges = [this.self.loc()];

    if (this.else) {
      ranges.push(this.else.loc());
    }

    return CST.joinLocRange(ranges);
  }

  async print(
    output: BufferAPI.BufWriter,
    indent: number = 0,
    indentFirst: boolean = true,
  ) {
    await this.self.print(output, indent, indentFirst);

    if (this.else) {
      await output.write(CST.PunctBytes.space);
      await this.else.print(output, indent, false);
    }
  }
}

export type Expr =
  | FFIStringLiteral
  | IntLiteral
  | Call
  | ID
  | Tuple
  | Block
  | If
  | ExplicitSafetyStatement;

export type Any =
  | CST.Newline
  | CST.Multiline
  | Comment
  | Extern
  | FuncIon
  | VarIon
  | Expr;
