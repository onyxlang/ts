// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

export abstract class Node {
  readonly location: peggy.LocationRange;
  readonly text: string;

  constructor(location: peggy.LocationRange, text: string) {
    this.location = location;
    this.text = text;
  }
}
