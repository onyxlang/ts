// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

// @deno-types="https://deno.land/x/chalk_deno@v4.1.1-deno/index.d.ts"
import chalk from "https://deno.land/x/chalk_deno@v4.1.1-deno/source/index.js";

import { readLine } from "./util.ts";

export class Note {
  message: string;
  location: peggy.LocationRange;

  constructor(message: string, location: peggy.LocationRange) {
    this.message = message;
    this.location = location;
  }
}

export default class Panic extends Error {
  self: Note;
  notes: Note[];

  constructor(
    message: string,
    location: peggy.LocationRange,
    notes: Note[] = [],
  ) {
    super(message);
    this.self = new Note(message, location);
    this.notes = notes;
  }

  async log({ backtrace = false }) {
    const line = await readLine(
      this.self.location.source,
      this.self.location.start.line - 1,
    );

    if (!line) {
      throw Error(
        `Could not read line ${this.self.location.start.line} from ${this.self.location.source}`,
      );
    }

    // deno-fmt-ignore-start
    const message = `${chalk.bgRed.bold("  Panic!  ")} ${this.self.message}

  ${chalk.gray("@")} ${chalk.cyan(`${this.self.location.source}:${this.self.location.start.line}:${this.self.location.start.column}`)}

    ${chalk.gray(`${this.self.location.start.line}. |`)} ${chalk.cyan.bold(line)}
         ${' '.repeat(this.self.location.start.column)}${chalk.red.bold('^'.repeat(this.self.location.end.column - this.self.location.start.column))}
    ${this.self.message}
`;
    // deno-fmt-ignore-end

    console.error(message);

    if (backtrace) {
      console.error(this.stack);
    }
  }
}
