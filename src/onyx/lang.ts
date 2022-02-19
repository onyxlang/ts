export enum Keyword {
  // Modules
  //

  IMPORT = "import",
  FROM = "from",
  EXPORT = "export",
  DEFAULT = "default",

  // Safety
  //

  UNSAFE = "unsafe",
  FRAGILE = "fragile",
  THREADSAFE = "threadsafe",
  UNSAFE_BANG = "unsafe!",
  FRAGILE_BANG = "fragile!",
  THREADSAFE_BANG = "threadsafe!",

  // Well-known modifiers
  //

  BUILTIN = "builtin",

  // Directives
  //

  EXTERN = "extern",
  FINAL = "final",
  DEF = "def",
  STRUCT = "struct",

  // Statements
  //

  IF = "if",
  THEN = "then",
  ELIF = "elif",
  ELSE = "else",

  // Instructions
  //

  RETURN = "return",
}

export enum Safety {
  UNSAFE = "unsafe",
  FRAGILE = "fragile",
  THREADSAFE = "threadsafe",
}

export enum Storage {
  STATIC = "static",
  INSTANCE = "instance",
  LOCAL = "local",
}

export enum Access {
  STATIC = "::",
  INSTANCE = ".",
}
