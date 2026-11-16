/*
 * AI assistance was used to rewrite this module in a clearer form.
 * The responsibilities follow Game.java and GameEngine.java in FishGame26.zip
 * (Marc Conrad's teaching example). UI and network code are kept outside it.
 */
export class GameEngine {
  constructor(options) {
    if (options === undefined) {
      options = {};
    }
    this.mode = "practice";
    if (options.mode === "timed") {
      this.mode = "timed";
    }
    this.source = "live";
    this.now = Date.now;
    if (options.now !== undefined) {
      this.now = options.now;
    }
    this.total = 10;
    if (options.total !== undefined) {
      this.total = options.total;
    }
    this.id = crypto.randomUUID();
    this.score = 0;
    this.completed = 0;
    this.skipped = 0;
    this.timeouts = 0;
    this.skipsLeft = 2;
    this.wrongAttempts = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.status = "loading";
    this.question = null;
    this.secondsLeft = 10;
    this.deadline = null;
  }

  load(question) {
    if (this.status !== "loading") {
      throw new Error("Not waiting for a question.");
    }
    if (!Number.isInteger(question.answer)) {
      throw new Error("The fish count must be a whole number.");
    }
    if (question.answer < 0 || question.answer > 9) {
      throw new Error("The fish count must be from 0 to 9.");
    }
    this.question = question;
    this.secondsLeft = 10;
    this.status = "playing";
    this.deadline = null;
    if (this.mode === "timed") {
      this.deadline = this.now() + 10000;
    }
  }

  // AI assistance helped with preserving the remaining time during a pause.
  // A deadline is more reliable than subtracting one each time a callback runs.
  remaining() {
    if (this.deadline === null) {
      return this.secondsLeft;
    }
    let seconds = Math.ceil((this.deadline - this.now()) / 1000);
    if (seconds < 0) {
      seconds = 0;
    }
    return seconds;
  }

  pause() {
    if (this.status !== "playing") {
      return false;
    }
    this.secondsLeft = this.remaining();
    this.deadline = null;
    this.status = "paused";
    return true;
  }

  resume() {
    if (this.status !== "paused") {
      return false;
    }
    this.status = "playing";
    if (this.mode === "timed") {
      this.deadline = this.now() + this.secondsLeft * 1000;
    }
    return true;
  }

  answer(value) {
    if (this.status !== "playing") {
      return "ignored";
    }
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      return "ignored";
    }
    if (this.mode === "timed" && this.remaining() === 0) {
      return this.resolve("timeout");
    }
    if (value !== this.question.answer) {
      this.wrongAttempts = this.wrongAttempts + 1;
      this.streak = 0;
      return "wrong";
    }
    return this.resolve("correct");
  }

  skip() {
    if (this.status !== "playing" || this.skipsLeft === 0) {
      return "ignored";
    }
    if (this.mode === "timed" && this.remaining() === 0) {
      return this.resolve("timeout");
    }
    this.skipsLeft = this.skipsLeft - 1;
    return this.resolve("skipped");
  }

  tick() {
    if (this.status === "playing" && this.mode === "timed") {
      if (this.remaining() === 0) {
        return this.resolve("timeout");
      }
    }
    return null;
  }

  resolve(kind) {
    if (this.status !== "playing") {
      return "ignored";
    }
    this.secondsLeft = this.remaining();
    this.deadline = null;
    this.completed = this.completed + 1;
    if (kind === "correct") {
      this.score = this.score + 1;
      this.streak = this.streak + 1;
      if (this.streak > this.bestStreak) {
        this.bestStreak = this.streak;
      }
    } else {
      this.streak = 0;
      if (kind === "skipped") {
        this.skipped = this.skipped + 1;
      }
      if (kind === "timeout") {
        this.timeouts = this.timeouts + 1;
      }
    }
    // Feedback prevents a second click from scoring the same question twice.
    this.status = "feedback";
    return kind;
  }

  next() {
    if (this.status !== "feedback") {
      return false;
    }
    this.question = null;
    if (this.completed >= this.total) {
      this.status = "finished";
    } else {
      this.status = "loading";
    }
    return true;
  }

  result(incomplete) {
    if (incomplete === undefined) {
      incomplete = false;
    }
    return {
      id: this.id,
      date: new Date().toISOString(),
      mode: this.mode,
      source: this.source,
      score: this.score,
      total: this.total,
      completed: this.completed,
      skipped: this.skipped,
      timeouts: this.timeouts,
      wrongAttempts: this.wrongAttempts,
      bestStreak: this.bestStreak,
      incomplete: incomplete,
    };
  }
}
