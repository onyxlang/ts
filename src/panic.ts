// @deno-types="https://deno.land/x/chalk_deno@v4.1.1-deno/index.d.ts"
import chalk from "https://deno.land/x/chalk_deno@v4.1.1-deno/source/index.js";

import * as GenericAST from "./ast.ts";
import { readLineFromFile, readLineFromString } from "./util.ts";
import { LocationRange } from "./parser.ts";

export class Note {
  message: string;
  location?: LocationRange;

  constructor(message: string, location?: LocationRange) {
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
      let line: string | undefined;

      if (this.location.source.sourceCode) {
        line = await readLineFromString(
          this.location.source.sourceCode,
          this.location.start.line - 1,
        );
      } else {
        line = await readLineFromFile(
          this.location.source.filePath,
          this.location.start.line - 1,
        );
      }

      if (!line) {
        throw Error(
          `Could not read line ${this.location.start.line} from ${this.location.source.filePath}`,
        );
      }

      const lineIndex = this.location.start.line.toString();

      message += `

  ${chalk.gray("@")} ${
        chalk.cyan(
          `${this.location.source.filePath}:${this.location.start.line}` +
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
    location?: LocationRange,
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

export class AlreadyDeclared extends Panic {
  constructor(requested: GenericAST.Node, declared?: GenericAST.Node) {
    const notes = [];

    if (declared) {
      notes.push(new Note(`Previously declared here`, declared.location));
    }

    super(`Already declared \`${requested.text}\``, requested.location, notes);
  }
}
