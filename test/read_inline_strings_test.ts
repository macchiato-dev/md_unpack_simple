import { assertEquals } from "https://deno.land/std@0.102.0/testing/asserts.ts";
import { readInlineStrings } from "../mod.ts";

Deno.test("read inline string", () => {
  assertEquals(readInlineStrings("`wow`"), ["wow"]);
  assertEquals(
    readInlineStrings("``w`o`w`` `doge: cool`"),
    ["w`o`w", "doge: cool"]
  );
});
