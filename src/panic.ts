// @deno-types="https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.d.ts"
import peggy from "https://raw.githubusercontent.com/vladfaust/peggy/cjs-to-es15/lib/peg.js";

// @deno-types="https://deno.land/x/chalk_deno@v4.1.1-deno/index.d.ts"
import chalk from "https://deno.land/x/chalk_deno@v4.1.1-deno/source/index.js";

import { readLine } from "./util.ts";

export class Note {
  message: string;
  location?: peggy.LocationRange;

  constructor(message: string, location?: peggy.LocationRange) {
    this.message = message;
    this.location = location;
  }

  /**
   * @param aux Would be displayed as `NOTE (1/2)`
   */
  async log(aux?: { noteIndex: number; totalNotes: number }) {
    const header = aux
      ? chalk.bgGray.bold(`  Note ${aux.noteIndex}/${aux.totalNotes}  `)
      : chalk.bgRed.bold("  Panic!  ");

    let message = `${header} ${this.message}`;

    if (this.location) {
      const line = await readLine(
        this.location.source,
        this.location.start.line - 1,
      );

      if (!line) {
        throw Error(
          `Could not read line ${this.location.start.line} from ${this.location.source}`,
        );
      }

      const lineIndex = this.location.start.line.toString();

      message += `

  ${chalk.gray("@")} ${
        chalk.cyan(
          `${this.location.source}:${this.location.start.line}` +
            `:${this.location.start.column}:${this.location.end.line}:` +
            `${this.location.end.column}`,
        )
      }

    ${chalk.gray(`${lineIndex}. | `)}${chalk.cyan.bold(line)}
    ${" ".repeat(lineIndex.length + 4 + this.location.start.column - 1)}${
        chalk[aux ? "gray" : "red"].bold(
          "^".repeat(this.location.end.column - this.location.start.column),
        )
      }`;
    }

    console.error(message);
  }
}

export default class Panic extends Error {
  self: Note;
  notes: Note[];

  constructor(
    message: string,
    location?: peggy.LocationRange,
    notes: Note[] = [],
  ) {
    super(message);
    this.self = new Note(message, location);
    this.notes = notes;
  }

  async log({ backtrace = false }) {
    await this.self.log();

    for (const [index, note] of this.notes.entries()) {
      await note.log({
        noteIndex: index + 1,
        totalNotes: this.notes.length,
      });
    }

    if (backtrace) {
      console.error(this.stack);
    }
  }
}
