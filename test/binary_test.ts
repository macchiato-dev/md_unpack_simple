import { equals } from "https://deno.land/std@0.102.0/bytes/mod.ts";
import { assert } from "https://deno.land/std@0.102.0/testing/asserts.ts";
import { unpack } from "../mod.ts";

Deno.test("binary", async () => {
  const text = await Deno.readTextFile('./test/binary.md');
  const files = await unpack(text);
  for (const path of ['test1', 'test2', 'test3']) {
    const value = (files || {})[path];
    if (value instanceof Uint8Array) {
      assert(equals(value, new Uint8Array([0, 1, 2, 3, 255])));
    } else {
      throw new Error('value is not a Uint8Array');
    }
  }
});
