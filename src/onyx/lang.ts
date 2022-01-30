export enum Keyword {
  EXTERN = "extern",

  DEF = "def",
  BUILTIN = "builtin",

  IF = "if",
  THEN = "then",
  ELIF = "elif",
  ELSE = "else",

  UNSAFE = "unsafe",
  FRAGILE = "fragile",
  THREADSAFE = "threadsafe",

  UNSAFE_BANG = "unsafe!",
  FRAGILE_BANG = "fragile!",
  THREADSAFE_BANG = "threadsafe!",
}

export enum Safety {
  UNSAFE,
  FRAGILE,
  THREADSAFE,
}

export enum FuncAction {
  Def = "def",
}
