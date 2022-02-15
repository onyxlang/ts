# Onyx

_Enjoy the performance._

## 👋 About

Onyx is a fresh programming language with efficiency in mind.
This repository contains the reference Onyx compiler implementation.

## ⚠️ Experimental branch!

The language consists of three commands: comment (`#`), mod (`@`) and expression (anything else).

A mod passes AST succeeding nodes to a delayed macro, which is aware of the compiler context.
The context allows to emit Onyx source code, or assembly code.

```nx
# "Declare mod named `log`, which accepts a single argument"
@mod log(node) \{%
  // Here we're are in the context of compiler.
  // For now, it's Typescript, but in could be Onyx.
  console.log(node)
%};

foo()
@log 42 # Apply the mod `log` to AST node `42`
bar()

# Would output during compilation:
IntLiteral

# As `@log` doesn't emit anything to the source code, the resulting code would be:
foo()
 # Apply the mod `log` to AST node `42`
bar()
```

Semantic of a mod stack is similar to Ruby's paren-less calls.

```nx
@mod foo(node) \{%
  console.log("foo!")
%}

@foo @log 42 # Outputs `42`, then `foo!`
```

Nested mods may be defined.
A nested mod may be shortcut when within a block argument of the mod application.
In a mods sequence, the last mod is considered the nested mod's parent if shortcut.

```nx
@export~default @mod struct (id, body) \{%
  console.log("struct")
%}

@mod struct.builtin (id, body) \{%
  console.log("struct.builtin")
%}

@mod struct.*.fn (id, body) \{%
  console.log("struct.*.fn")
%}

@struct.builtin Foo { # => struct.builtin
  @.fn bar() {        # => struct.*.fn (matched `struct.builtin.fn`)
    @return baz       # The `@return` modifier is builtin, no need to import
  }
}
```

With that simple semantic in mind, even basic constructs may be defined in Onyx itself, for example `@mod class`, `@mod if` etc.

## 🚧 Development

A _stage_ is defined by the a set of rules in no particular order.
Currently, the compiler is at the **stage I** implementation effort.

### Stage I: ⬅️

1. Compiler logic (i.e. _frontend_) is written in [Typescript](https://www.typescriptlang.org), utilizing [Peggyjs](https://github.com/onyxlang/peggy).
1. [Zig](https://github.com/ziglang/zig) is used as the _backend_: Onyx source code is translated to Zig source code.
1. Host machine is expected to have Zig installed on it.
1. [Deno](https://deno.land) is assumed the development environment.
1. Development speed > runtime performance > correctness.
    1. Macros are not implemented.
    1. Panics are shallow and incomplete.
1. May assume that target is a mainstream Windows, Linux or MacOS machine.
1. Target may rely on Zig standard library.

### Stage II:

1. Compiler logic (i.e. _frontend_) is written in Onyx.
1. [Zig](https://github.com/ziglang/zig) is used as the _backend_: Onyx source code is translated to Zig source code.
1. Host machine is expected to have Zig installed on it.
1. Development speed > correctness > runtime performance.
    1. Macros are not implemented.
1. May assume that target is a mainstream Windows, Linux or MacOS machine.
1. Target may rely on Zig standard library.

### Stage III:

1. Compiler logic (i.e. _frontend_) is written in Onyx.
1. [Zig](https://github.com/ziglang/zig) is used as the _backend_: Onyx source code is translated to Zig source code internally.
1. _(Extraneous)_ Host machine is expected to have Zig installed on it.[^1]
1. Correctness > development speed > runtime performance.
1. Target may rely on Zig standard library.

[^1]: By that time Zig could become linkable as a static library.

### Stage IV:

1. Compiler is written in Onyx.
1. Correctness > (developer happiness = runtime performance).

## 📜 License

Any contribution to this repository is MIT licensed in accordance to [GitHub ToS § 6](https://docs.github.com/en/github/site-policy/github-terms-of-service#6-contributions-under-repository-license).
