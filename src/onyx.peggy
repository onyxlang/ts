// The global initializer.
{{
  const poly = options.poly
  const nx = options.nx
  const c = options.c
}}

// A per-parse initializer.
{
  console.debug(`Parsing ${options.grammarSource}`)
}

// Entry point
//

start = wsp?
  head:top_level
  tail:(sp? @top_level)*
  EOF
{
  return [head].concat(tail);
}

top_level =
  ml / nl /
  (@(
    comment /
    extern_drct /
    safety_stmt /
    func_ion /
    expr
  ) term)

// Punctuation
//

EOF = !.

sp = ' '+ // TODO: Include other horizontal space characters

nl = ('\n\r' / '\n' / '\r') {
  return new  poly.CST.Newline(location(), text())
}

ml = nl nl+ {
  return new poly.CST.Multiline(location(), text())
}

wsp = sp? (ml / nl)? sp?
semi = ';'
term = semi / &nl / &EOF // Onyx terminator
nadj = sp / nl // Non-adjacent (e.g. `if` body expression may be on a new line)

comment = '#' value:$([^\n\r]+) (&nl / &EOF) {
  return new nx.CST.Comment(location(), text(), value)
}

// Keywords
//

kw_def     = "def"     { return new nx.CST.Keyword(location(), text(), nx.Keyword.DEF) }
kw_builtin = "builtin" { return new nx.CST.Keyword(location(), text(), nx.Keyword.BUILTIN) }
kw_if      = "if"      { return new nx.CST.Keyword(location(), text(), nx.Keyword.IF) }
kw_then    = "then"    { return new nx.CST.Keyword(location(), text(), nx.Keyword.THEN) }
kw_elif    = "elif"    { return new nx.CST.Keyword(location(), text(), nx.Keyword.ELIF) }
kw_else    = "else"    { return new nx.CST.Keyword(location(), text(), nx.Keyword.ELSE) }
kw_extern  = "extern"  { return new nx.CST.Keyword(location(), text(), nx.Keyword.EXTERN) }

kw_unsafe = "unsafe" {
  return new nx.CST.Keyword(location(), text(), nx.Keyword.UNSAFE)
}

kw_fragile = "fragile" {
  return new nx.CST.Keyword(location(), text(), nx.Keyword.FRAGILE)
}

kw_threadsafe = "threadsafe" {
  return new nx.CST.Keyword(location(), text(), nx.Keyword.THREADSAFE)
}

kw_unsafe_bang = "unsafe!" {
  return new nx.CST.Keyword(location(), text(), nx.Keyword.UNSAFE_BANG)
}

kw_fragile_bang = "fragile!" {
  return new nx.CST.Keyword(location(), text(), nx.Keyword.FRAGILE_BANG)
}

kw_threadsafe_bang = "threadsafe!" {
  return new nx.CST.Keyword(location(), text(), nx.Keyword.THREADSAFE_BANG)
}

// Literals
//

int_literal = $('0' / ([1-9] [0-9]*)) {
  return new nx.CST.IntLiteral(location(), text())
}

// Expressions
//

expr = int_literal / ffi_str_lit / safety_stmt / if / block / call

id = $([a-zA-Z_] [a-zA-Z_0-9]* [!?]?) {
  return new nx.CST.ID(location(), text(), {
    kind: nx.CST.IDKind.COMMON,
    wrapped: false,
    value: text()
  })
}

// Variables
//

restriction = sp ':' sp id:id {
  return new nx.CST.Restriction({ real: id })
}

label = value:id ':' {
  return new nx.CST.ID(location(), text(), {
    kind: nx.CST.IDKind.LABEL,
    wrapped: false,
    value: value.raw
  })
}

var_ion = id:id restriction:restriction? {
  return new nx.CST.VarIon({ id, restriction })
}

// Function
//

func_ion_args_decl = '(' sp? multiline:(ml / nl)?
  head:var_ion
  tail:(wsp? "," wsp? @var_ion)*
  wsp? ')'
{
  return new nx.CST.FuncArgsDecl({
    location: location(),
    multiline: !!multiline,
    args: [head].concat(tail),
  });
}

func_ion =
  builtin:(@kw_builtin sp)?
  action:kw_def sp
  id:id
  args:func_ion_args_decl
  restriction:restriction?
{
  return new nx.CST.FuncIon({ builtin, action, id, args, restriction })
}

kwarg = label:label nadj expr:expr {
  return new nx.CST.KWArg({ label, value: expr })
}

call_args = '(' sp? multiline:(ml / nl)?
  head:(expr / kwarg)
  tail:(wsp? "," wsp? @(expr / kwarg))*
  wsp? ')'
{
  return new nx.CST.CallArgs({
    location: location(),
    multiline: !!multiline,
    args: [head].concat(tail),
  });
}

call = callee:(ffi_id / id) args:call_args {
  return new nx.CST.Call({ callee, args })
}

// Branching
//

block = '{' sp? multiline:(ml / nl)? sp?
  head:expr
  tail:(term wsp? @expr)*
  term? wsp? '}'
{
  return new nx.CST.Block({
    location: location(),
    multiline: !!multiline,
    exprs: [head].concat(tail)
  });
}

// Good: `else(expr)`, `else{expr}`, `else expr`, `else\nexpr`
_else = keyword:kw_else (&'(' / &'{' / nadj) body:expr {
  return new nx.CST.Else({ keyword, body })
}

// TODO:
if =
  kwIf:kw_if (&'(' / sp)
  cond:expr sp?
  kwThen:(@kw_then sp)?
  body:expr
  _else:(wsp? @_else)?
{
  const self = new nx.CST.Case({ caseKeyword: kwIf, cond, thenKeyword: kwThen, body })
  return new nx.CST.If({ self, _else })
}

// C
//

c_kw_const = "const" { return new c.CST.Keyword(location(), text(), c.Keyword.CONST) }

c_term = ';'

c_id = $([a-zA-Z_] [a-zA-Z_0-9]*) { return new c.CST.ID(location(), text()) }

c_type = id:c_id depth:'*'* {
  return new c.CST.TypeRef({ id, pointerDepth: depth.length })
}

c_arg_decl = constKeyword:(@c_kw_const sp)? type:c_type id:(sp @c_id)? {
  return new c.CST.ArgDecl({ constKeyword, type, id })
}

c_proto_args = '(' sp? multiline:(ml / nl)?
  head:c_arg_decl
  tail:(wsp? "," wsp? @c_arg_decl)*
  wsp? ')'
  {
    return new c.CST.ProtoArgsDecl({
      location: location(),
      multiline: !!multiline,
      args: [head].concat(tail)
    });
  }

c_proto = returnType:c_type sp id:c_id sp? args:c_proto_args sp? c_term {
  return new c.CST.Proto({ returnType, id, args })
}

// FFI
//

extern_drct = keyword:kw_extern sp value:c_proto {
  return new nx.CST.Extern({ keyword, value })
}

ffi_id = '$' cId:c_id {
  return new nx.CST.ID(location(), text(), {
    kind: nx.CST.IDKind.FFI,
    wrapped: false,
    value: cId.raw
  })
}

ffi_str_lit = '$' '"' value:$([^"\\] / "\\" .)* '"' {
  return new nx.CST.FFIStringLiteral(location(), text(), { value })
}

// Safety statement
//

safety_kw = kw_unsafe_bang / kw_fragile_bang / kw_threadsafe_bang
safety_stmt = keyword:safety_kw sp content:expr {
  return new nx.CST.ExplicitSafetyStatement({ keyword, content })
}
