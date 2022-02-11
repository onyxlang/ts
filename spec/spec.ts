const compiler_exe = Deno.args[0];
console.debug(`Running compiler specs for ${compiler_exe}`);

const zig_exe = Deno.args[1];
if (zig_exe) {
  console.debug(`Using Zig at ${zig_exe}`);
}

function run(path: string) {
  const cmd = [compiler_exe, "r", path];

  if (zig_exe) {
    cmd.push(...["--zig", zig_exe]);
  }

  return Deno.run({ cmd });
}

Deno.test("hello-world spec", async () => {
  const p = run("spec/hello-world.nx");
  if (!(await p.status()).success) Deno.exit(1);
  p.close();
});

Deno.test("basic spec", async () => {
  const p = run("spec/basic.nx");
  if (!(await p.status()).success) Deno.exit(1);
  p.close();
});
