// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

import { stringToBytes } from "./util.ts";
import * as BufferAPI from "https://deno.land/std@0.123.0/io/buffer.ts";

/**
 * Join multiple location ranges into a spanning one.
 *
 * @param ranges Location ranges to join
 * @returns      The joined location range
 */
export function joinLocRange(
  ranges: peggy.LocationRange[],
): peggy.LocationRange {
  const result = ranges[0];

  for (const range of ranges) {
    if (result.source !== range.source) {
      throw Error(
        `Location source mismatch upon joining them: ${result.source} vs. ${range.source}`,
      );
    }

    if (range.start.line < result.start.line) {
      result.start.line = range.start.line;
      result.start.column = range.start.column;
    } else if (
      range.start.line === result.start.line &&
      range.start.column < result.start.column
    ) {
      result.start.column = range.start.column;
    }

    if (range.end.line > result.end.line) {
      result.end.line = range.end.line;
      result.end.column = range.end.column;
    } else if (
      range.end.line === result.end.line &&
      range.end.column > result.end.column
    ) {
      result.end.column = range.end.column;
    }
  }

  return result;
}

/**
 * Print indentation.
 *
 * @param output   The output file
 * @param indent Indentation amount
 * @param symbol The indentation symbol
 */
export async function tab(
  output: BufferAPI.BufWriter,
  indent: number,
  symbol = "  ",
) {
  if (indent > 0) {
    await output.write(stringToBytes(symbol.repeat(indent)));
  }
}

/**
 * A CST node.
 */
export interface Node {
  loc(): peggy.LocationRange;

  /**
   * Print the node into source code.
   *
   * @param output      The output buffer
   * @param indent      Indentation
   * @param indentFirst If false, would omit the very first indentation
   */
  print(
    output: BufferAPI.BufWriter,
    indent: number,
    indentFirst: boolean,
  ): Promise<void>;
}

/**
 * A token, which is also a node.
 */
export class Token implements Node {
  private _placement: peggy.LocationRange;
  raw: string;

  constructor(loc: peggy.LocationRange, raw: string) {
    this._placement = loc;
    this.raw = raw;
  }

  loc() {
    return this._placement;
  }

  async print(output: BufferAPI.BufWriter, indent: number = 0) {
    await tab(output, indent);
    await output.write(stringToBytes(this.raw));
  }
}

/**
 * A collection of predefined printable punctuation bytes.
 * @example await output.write(PunctBytes.wrappedColon); // ` : `
 */
export const PunctBytes = {
  /** `␣` */ space: new Uint8Array([0x20]),
  /** `\n` */ newline: new Uint8Array([0x0A]),
  /** `\n\n` */ multiline: new Uint8Array([0x0A, 0x0A]),

  /** `;` */ semi: new Uint8Array([0x3B]),
  /** `:` */ colon: new Uint8Array([0x3A]),
  /** `,` */ comma: new Uint8Array([0x2C]),
  /** `~` */ tilde: new Uint8Array([0x7E]),
  /** `$` */ dollar: new Uint8Array([0x24]),
  /** `` ` `` */ backtick: new Uint8Array([0x60]),
  /** `*` */ asterisk: new Uint8Array([0x2A]),

  /** `(` */ openParen: new Uint8Array([0x28]),
  /** `)` */ closeParen: new Uint8Array([0x29]),
  /** `{` */ openBracket: new Uint8Array([0x7B]),
  /** `}` */ closeBracket: new Uint8Array([0x7D]),

  /** `␣:␣` */ wrappedColon: new Uint8Array([0x20, 0x3A, 0x20]),
  /** `␣~␣` */ wrappedTilde: new Uint8Array([0x20, 0x7E, 0x20]),
  /** `,␣` */ commaSpace: new Uint8Array([0x2C, 0x20]),
};

/**
 * A single newline, e.g. in
 *
 * ```nx
 * foo
 *   bar
 * ```
 */
export class Newline extends Token {
  async print(output: BufferAPI.BufWriter, _indent: number = 0) {
    await output.write(PunctBytes.newline);
  }
}

/**
 * One or more empty lines, e.g. in
 *
 * ```nx
 * foo
 *
 *   bar
 * ```
 */
export class Multiline extends Token {
  async print(output: BufferAPI.BufWriter, _indent: number = 0) {
    await output.write(PunctBytes.multiline);
  }
}

/**
 * Print CST nodes.
 *
 * @param output The output buffer
 * @param nodes  Nodes to print
 * @param indent Indentation, if any
 */
export async function print(
  output: BufferAPI.BufWriter,
  nodes: Node[],
  indent: number = 0,
) {
  for (const node of nodes) {
    await node.print(output, indent, false);
  }
}
