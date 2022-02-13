// The global initializer.
{{
  const Onyx = options.Onyx
  const C = options.C
  const Generic = options.Generic
  const util = options.util
}}

// A per-parse initializer.
{
  trace(`Parsing ${options.grammarSource}`)

  function node() {
    return new Generic.AST.Node(location(), text())
  }

  function trace(rule, customText = undefined) {
    if (options.trace)
      console.debug(`${rule.padStart(20)} | ${customText || text()}`)
  }
}

// End-Of-File.
EOF = !.

// A comment spans until the end of the line.
comment = '#' value:$([^\n\r]+) (&nl / &EOF) {
  return new Onyx.CST.Comment(location(), text(), { value })
}

// Horizontal space.
sp = ' '+ // TODO: Include other horizontal space characters

// A single newline.
nl = sp? ('\n\r' / '\n' / '\r') sp?

// "Wide-space", i.e. any amount of space.
wsp = nl+ / sp

// "Non-adjacent", i.e. space or a single newline.
nadj = nl / sp

// Onyx terminator is either semi or newline.
term = sp? ((';' wsp?) / nl+ / &')' / &'}' / &']' / &'>' / &EOF)

// Higher-level structure
//

directive = extern
declaration = final / struct / def
statement = explicit_safety / if
instruction = return
literal = int_literal
expression = declaration / statement / instruction / rval

top_level = wsp?
  head:(directive / expression)
  tail:(term wsp? @(directive / expression))*
  term? wsp? EOF
{
  return [head].concat(tail)
}

// Directive
//

extern = keyword:kw_extern sp value:c_prototype {
  trace(`extern`)
  return new Onyx.AST.Extern(location(), text(), { keyword, value })
}

// Declaration
//

final = kw_final sp id:id type:(sp? ':' sp? @id)? value:(sp? '=' nadj? @rval) {
  trace(`final`)
  return new Onyx.AST.Final(location(), text(), { id, type, value })
}

struct = builtin:kw_builtin sp kw_struct sp id:id sp? body:block {
  trace(`struct`)

  const modifiers = []
  if (builtin) modifiers.push(builtin)

  return new Onyx.AST.Struct(location(), text(), { modifiers, id, body })
}

def_arg = id:id sp? ':' sp? type:id value:(sp? '=' nadj? @rval)? {
  return new Onyx.AST.DefArg(location(), text(), { id, type, value })
}

def_args = head:def_arg? tail:(sp? ',' nadj? @def_arg)* {
  return head ? [head].concat(tail) : []
}

def =
  builtin:(@kw_builtin sp)?
  keyword:kw_def sp
  id:(unary_operator / binary_operator / id) sp?
  '(' nadj? args:(@def_args nadj?) ')'
  sp? ':' sp? returnType:id
  sp? body:block?
{
  trace(`def`)

  const modifiers = []
  if (builtin) modifiers.push(builtin)

  return new Onyx.AST.Def(location(), text(), {
    modifiers,
    keyword,
    id,
    args,
    returnType,
    body
  })
}

// Statement
//

case =
  '(' wsp? cond:(instruction / rval) wsp? ')' nadj?
  body:(block / instruction / rval)
{
  return new Onyx.AST.Case(location(), text(), { cond, body })
}

if =
  kw_if sp? self:case term
  elifs:(kw_elif sp? @case term)*
  _else:(kw_else sp? @(block / instruction / rval) term)?
{
  trace(`if`)
  return new Onyx.AST.If(location(), text(), { self, elifs, _else })
}

// Instruction
//

explicit_safety =
  safety:('@' @("unsafe" / "fragile" / "threadsafe") '!' nkw) sp?
  body:(block / instruction / rval)
{
  trace(`explicit_safety`)
  return new Onyx.AST.ExplicitSafety(location(), text(), {
    safety: Onyx.Lang.Safety[safety],
    body
  })
}

return = kw_return rvalue:(sp? @rval)? {
  trace(`return`)
  return new Onyx.AST.Return(location(), text(), { value: rvalue })
}

// RVal
//

prim = block / ffi_id / literal / id

unary_operator = $[+\-!~] {
  trace(`unary_operator`)
  return new Onyx.AST.ID(location(), text())
}

binary_operator = $([+\-*/%^<]+ '='?) {
  trace(`binary_operator`)
  return new Onyx.AST.ID(location(), text())
}

rval =
  unOp:unary_operator?
  prim:prim
  tail:(
    query_suffix /
    call_suffix /
    bin_op_suffix
  )*
{
  if (tail.length > 0) {
    let result = tail[0](prim)

    for (let i = 1; i < tail.length; i++) {
      result = tail[i](result)
    }

    if (unOp) {
      trace(`unop`)
      return new Onyx.AST.UnOp(location(), text(),
        { operator: unOp, operand: result })
    } else {
      return result
    }
  } else {
    if (unOp) {
      trace(`unop`)
      return new Onyx.AST.UnOp(location(), text(),
        { operator: unOp, operand: prim })
    } else {
      // BUG: For some reason `0` is a simple string `"0"`, not a literal.
      if (text() == "0") {
        trace(`(bug) int_literal`)
        return new Onyx.AST.IntLiteral(location(), text())
      } else {
        return prim
      }
    }
  }
}

query_suffix = access:access id:id {
  const _location = location()
  const _text = text()

  return (container) => {
    trace(`query`, container.text + _text)

    return new Onyx.AST.Query(
      util.joinLocationRanges([container.location, _location]),
      container.text + _text,
      {
        container,
        access,
        id
      })
  }
}

call_args = '(' wsp?
  head:rval?
  tail:(wsp? ',' wsp? rval)*
  wsp? ','? wsp? ')'
{
  return head ? [head].concat(tail) : []
}

call_suffix = args:call_args {
  const _location = location()
  const _text = text()

  return (callee) => {
    trace(`call`, callee.text + _text)

    return new Onyx.AST.Call(
      util.joinLocationRanges([callee.location,  _location]),
      callee.text + _text,
      {
        callee,
        args
      })
  }
}

bin_op_suffix = sp? operator:binary_operator sp? right:rval {
  const _location = location()
  const _text = text()

  return (left) => {
    trace(`binop`, left.text + _text)

    return new Onyx.AST.BinOp(
      util.joinLocationRanges([left.location, _location]),
      left.text + _text,
      {
        left,
        operator,
        right
      })
  }
}

query = id:id tail:query_suffix* {
  trace(`query`)

  if (tail && tail.length > 0) {
    let result = tail[0](id)

    for (let i = 1; i < tail.length; i++) {
      result = tail[i](result)
    }

    return result
  } else {
    return new Onyx.AST.Query(location(), text(), { id })
  }
}

access_instance = '.' { return Onyx.Lang.Access.INSTANCE }
access = access:access_instance

// Literal
//

int_literal = @'0' ![0-9] / $([1-9] [0-9]*) {
  trace(`int_literal`)
  return new Onyx.AST.IntLiteral(location(), text())
}

// Expression
//

// Misc.
//

block = '{' wsp?
  head:expression?
  tail:(term sp? @expression)*
  term? wsp? '}'
{
  trace(`block`)
  return new Onyx.AST.Block(location(), text(), {
    body: (head ? [head].concat(tail) : [])
  })
}

id = $([a-zA-Z_] [a-zA-Z_0-9]* [!?]?) {
  trace(`id`)
  return new Onyx.AST.ID(location(), text())
}

// FFI
//

c_id = $([a-zA-Z_] [a-zA-Z_0-9]*) { return new Generic.AST.Node(location(), text()) }

ffi_id = '$' value:c_id {
  trace(`ffi_id`)
  return new Onyx.AST.CID(location(), text(), { value })
}

c_type_ref = id:c_id {
  return new C.AST.TypeRef(location(), text())
}

c_arg = type:c_type_ref id:(sp @c_id)? {
  return new C.AST.ArgDecl(location(), text(), { type, id })
}

c_proto_args = '(' wsp?
  head:c_arg?
  tail:(wsp? ',' wsp? @c_arg)*
  wsp? ')'
{
  return head ? [head].concat(tail) : [];
}

c_prototype = returnType:c_type_ref sp id:c_id sp? args:c_proto_args sp? ';' {
  return new C.AST.Prototype(location(), text(), { returnType, id, args })
}

// Keywords
//

nkw = ![a-zA-Z_0-9!] // "Not keyword"

kw_extern = "@extern" nkw { return node() }
kw_builtin = "@builtin" nkw { return node() }

kw_final = "@final" nkw { return node() }
kw_def = "@def" nkw { return node() }
kw_struct = "@struct" nkw { return node() }

kw_if = "@if" nkw { return node() }
kw_then = "@then" nkw { return node() }
kw_elif = "@elif" nkw { return node() }
kw_else = "@else" nkw { return node() }

kw_unsafe = "@unsafe" nkw { return node() }
kw_fragile = "@fragile" nkw { return node() }
kw_threadsafe = "@threadsafe" nkw { return node() }

kw_unsafe_bang = "@unsafe!" nkw { return node() }
kw_fragile_bang = "@fragile!" nkw { return node() }
kw_threadsafe_bang = "@threadsafe!" nkw { return node() }

kw_return = "@return" nkw { return node() }

// C keywords
//

c_kw_const = "const" { return node() }
