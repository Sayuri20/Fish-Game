import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../dist/js/game-engine.js";
import { parseQuestion } from "../dist/js/fish-api.js";
const question = { answer: 5, image: null, source: "live" };
test("correct answer scores once; duplicate clicks are ignored", () => {
  const g = new GameEngine();
  g.load(question);
  assert.equal(g.answer(5), "correct");
  assert.equal(g.answer(5), "ignored");
  assert.equal(g.score, 1);
  assert.equal(g.completed, 1);
});
test("wrong answer retains question and does not advance or score", () => {
  const g = new GameEngine();
  g.load(question);
  assert.equal(g.answer(4), "wrong");
  assert.equal(g.status, "playing");
  assert.equal(g.question, question);
  assert.equal(g.completed, 0);
  assert.equal(g.score, 0);
  assert.equal(g.answer(5), "correct");
});
test("exactly two skips per session; wrong attempts do not consume skips", () => {
  const g = new GameEngine();
  for (let i = 0; i < 2; i++) {
    g.load(question);
    assert.equal(g.skip(), "skipped");
    g.next();
  }
  g.load(question);
  assert.equal(g.skip(), "ignored");
  assert.equal(g.skipped, 2);
  assert.equal(g.skipsLeft, 0);
  assert.equal(g.score, 0);
});
test("timed pause/resume excludes paused time", () => {
  let clock = 1000;
  const g = new GameEngine({ mode: "timed", now: () => clock });
  g.load(question);
  clock += 2500;
  assert.equal(g.remaining(), 8);
  g.pause();
  clock += 60000;
  assert.equal(g.remaining(), 8);
  g.resume();
  clock += 7000;
  assert.equal(g.remaining(), 1);
  assert.equal(g.tick(), null);
  clock += 1000;
  assert.equal(g.tick(), "timeout");
  assert.equal(g.tick(), null);
  assert.equal(g.completed, 1);
  assert.equal(g.timeouts, 1);
});
test("answer at expired deadline cannot earn a point", () => {
  let clock = 0;
  const g = new GameEngine({ mode: "timed", now: () => clock });
  g.load(question);
  clock = 10000;
  assert.equal(g.answer(5), "timeout");
  assert.equal(g.score, 0);
  assert.equal(g.timeouts, 1);
});
test("skip at expired deadline counts as timeout and preserves skip budget", () => {
  let clock = 0;
  const g = new GameEngine({ mode: "timed", now: () => clock });
  g.load(question);
  clock = 10001;
  assert.equal(g.skip(), "timeout");
  assert.equal(g.skipsLeft, 2);
});
test("timer starts only when the question is ready, never during loading or practice", () => {
  let clock = 0;
  const g = new GameEngine({ mode: "timed", now: () => clock });
  clock += 60000;
  assert.equal(g.tick(), null);
  g.load(question);
  assert.equal(g.remaining(), 10);
  const p = new GameEngine({ now: () => clock });
  p.load(question);
  clock += 999999;
  assert.equal(p.tick(), null);
  assert.equal(p.status, "playing");
});
test("session ends after ten outcomes, with consistent score/breakdown", () => {
  const g = new GameEngine({ source: "live" });
  for (let i = 0; i < 10; i++) {
    g.load(question);
    if (i < 2) g.skip();
    else g.answer(5);
    g.next();
  }
  assert.equal(g.status, "finished");
  const r = g.result();
  assert.equal(r.score, 8);
  assert.equal(r.skipped, 2);
  assert.equal(r.completed, 10);
  assert.equal(r.source, "live");
  assert.equal(r.bestStreak, 8);
});
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
