import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestion } from "../dist/js/fish-api.js";
test("API uses fish field, not chest; preserves original base64 image", () => {
  const raw = "iVBORw0KGgoAAAANSUhEUgAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const q = parseQuestion({ fish: 5, chest: 9, question: raw });
  assert.equal(q.answer, 5);
  assert.equal(q.image, "data:image/png;base64," + raw);
  assert.throws(() => parseQuestion({ fish: 12, question: raw }));
  assert.throws(() =>
    parseQuestion({ fish: 2, question: "javascript:alert(1)" }),
  );
});
