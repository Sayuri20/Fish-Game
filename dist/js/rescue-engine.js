/**
 * AI assistance helped implement survival collisions and the shield timer.
 * Rules do not access the DOM, external API or database.
 */
export const ZONES = [
  "Moonlit Lagoon",
  "Coral Gardens",
  "Twilight Reef",
  "Sunken Ruins",
  "Midnight Abyss",
];
export const DEPTHS = [20, 80, 160, 280, 450];
export const CHARACTERS = [
  { id: "turtle", name: "Tidekeeper", kind: "Turtle" },
  { id: "fish", name: "Finflash", kind: "Fish" },
  { id: "mermaid", name: "Pearlwave", kind: "Mermaid" },
];
export const LEVEL_SECONDS = 30;
import { findBonus } from "./workshop.js";
export class RescueEngine {
  constructor(random = Math.random, character = "turtle") {
    this.random = random;
    this.character = character;
    this.id = crypto.randomUUID();
    this.level = 0;
    this.lives = 3;
    this.ammo = 6;
    this.pearls = 0;
    this.score = 0;
    this.correct = 0;
    this.stuns = 0;
    this.bonus = null;
    this.bonusUsed = false;
    this.magnetTime = 0;
    this.slowTime = 0;
    this.shield = 0;
    this.boostCooldown = 0;
    this.player = { x: 15, y: 50 };
    this.bounds = { left: 7, right: 74, top: 14, bottom: 86 };
    this.enemyTop = 17;
    this.enemyBottom = 83;
    this.enemy = { x: 87, y: 35, health: 8, stun: 0 };
    this.paused = false;
    this.events = [];
    this.serial = 0;
    this.beginLevel();
  }
  beginLevel() {
    this.elapsed = 0;
    this.attackInterval = [1.05, 0.8, 0.6, 0.43, 0.3][this.level];
    this.poisonSpeed = [34, 42, 50, 59, 69][this.level];
    this.fireTimer = this.attackInterval;
    this.supplyWave = 0;
    this.hazardWave = 0;
    this.boostTokens = 0;
    this.shieldDrops = 0;
    this.shotCooldown = 0;
    this.invulnerable = 2;
    this.poison = [];
    this.shots = [];
    this.items = [];
    this.enemy.health = 8 + this.level * 3;
    this.enemy.stun = 0;
    this.boostReady = false;
    this.countDone = true;
    this.answer = undefined;
    this.trash = 0;
    this.cleanMeter = 0;
    this.treasures = 0;
    this.status = "playing";
    this.reason = "";
    const types = ["bottle", "bag", "star", "shell", "conch", "seahorse"];
    for (const type of types) this.spawnItem(type);
    this.spawnItem("puffer");
  }
  spawnItem(type) {
    // Here I spread the items out so they do not appear on the player.
    if (this.items.length >= 14) return false;
    const start = Math.floor(this.random() * 12);
    let best = null;
    let bestSpace = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const cell = (start + attempt) % 12;
      const x = 26 + (cell % 4) * 14 + (this.random() - 0.5) * 4;
      const y = 28 + Math.floor(cell / 4) * 23 + (this.random() - 0.5) * 4;
      let space = Math.max(
        Math.abs(x - this.player.x) / 12,
        Math.abs(y - this.player.y) / 18,
      );
      for (const item of this.items) {
        const gap = Math.max(
          Math.abs(x - item.x) / 10,
          Math.abs(y - item.y) / 16,
        );
        space = Math.min(space, gap);
      }
      if (space > bestSpace) {
        bestSpace = space;
        best = { x, y };
      }
      if (space >= 1) break;
    }
    this.items.push({
      id: this.serial++,
      type,
      x: best.x,
      y: best.y,
      expires: this.elapsed + 11,
    });
    return true;
  }

  load(question) {
    if (
      this.status !== "playing" ||
      this.boostTokens < 1 ||
      this.boostReady ||
      this.boostCooldown > 0
    )
      return false;
    this.answer = question.answer;
    this.boostReady = true;
    this.countDone = false;
    return true;
  }
  answerNumber(number) {
    if (!this.isPlaying() || !this.boostReady) return "ignored";
    if (number !== this.answer) return "wrong";
    this.countDone = true;
    this.boostReady = false;
    this.correct++;
    this.boostTokens--;
    this.shield = 10;
    this.boostCooldown = 10;
    this.score += 20;
    this.givePearls(2);
    this.events.push({ kind: "shield", text: "Shield active for 10 seconds!" });
    return "correct";
  }
  equipBonus(id) {
    if (this.bonus || this.bonusUsed || !findBonus(id)) return false;
    this.bonus = id;
    return true;
  }
  useBonus() {
    if (!this.isPlaying() || !this.bonus || this.bonusUsed) return false;
    this.bonusUsed = true;
    if (this.bonus === "bubbles") this.ammo += 6;
    if (this.bonus === "magnet") this.magnetTime = 8;
    if (this.bonus === "slow") this.slowTime = 5;
    if (this.bonus === "cleaner") {
      for (let count = 0; count < 2; count++) {
        let nearest = null;
        let distance = Infinity;
        for (const item of this.items) {
          if (item.type !== "bottle" && item.type !== "bag") continue;
          const gap = Math.hypot(
            item.x - this.player.x,
            item.y - this.player.y,
          );
          if (gap < distance) {
            distance = gap;
            nearest = item;
          }
        }
        if (nearest) this.collect(nearest.id, true);
      }
    }
    this.events.push({
      kind: "workshop",
      text: findBonus(this.bonus).name + " activated!",
    });
    return true;
  }
  givePearls(amount) {
    this.pearls += amount;
    this.ammo += amount * 3;
  }
  move(dx, dy, seconds) {
    if (!this.isPlaying()) return;
    this.player.x = Math.max(
      this.bounds.left,
      Math.min(this.bounds.right, this.player.x + dx * seconds * 37),
    );
    this.player.y = Math.max(
      this.bounds.top,
      Math.min(this.bounds.bottom, this.player.y + dy * seconds * 55),
    );
  }
  shoot() {
    if (!this.isPlaying() || this.shotCooldown > 0 || this.ammo === 0)
      return false;
    this.ammo--;
    this.shotCooldown = 0.28;
    this.shots.push({
      id: this.serial++,
      x: this.player.x + 6,
      y: this.player.y,
      active: true,
    });
    return true;
  }
  collect(id, remote = false) {
    if (!this.isPlaying()) return false;
    let index = -1;
    for (let i = 0; i < this.items.length; i++)
      if (this.items[i].id === id) index = i;
    if (index < 0) return false;
    const item = this.items[index];
    if (
      !remote &&
      (Math.abs(item.x - this.player.x) > 8 ||
        Math.abs(item.y - this.player.y) > 13)
    )
      return false;
    this.items.splice(index, 1);
    if (item.type === "shield") {
      this.boostTokens++;
      this.events.push({
        kind: "booster",
        text: "Count the fish to power your shield!",
      });
      return true;
    }
    if (item.type === "puffer") {
      this.score = Math.max(0, this.score - 10);
      this.pearls = Math.max(0, this.pearls - 2);
      this.events.push({
        kind: "penalty",
        text: "Spiny fish! -10 points · -2 pearls",
      });
      return true;
    }
    if (item.type === "bottle" || item.type === "bag") {
      this.trash++;
      this.cleanMeter++;
      if (this.cleanMeter === 2) {
        this.cleanMeter = 0;
        const before = this.lives;
        this.lives = Math.min(3, this.lives + 1);
        this.events.push({
          kind: "heal",
          text:
            before < 3
              ? "Ocean cleaned! +1 heart"
              : "Ocean cleaned! Hearts are full.",
        });
      }
    } else this.treasures++;
    this.score += item.type === "seahorse" ? 10 : 5;
    this.givePearls(1);
    this.events.push({
      kind: "collect",
      text: "+1 pearl · +3 shots",
      type: item.type,
    });
    return true;
  }
  hurt() {
    if (!this.isPlaying() || this.invulnerable > 0 || this.shield > 0)
      return false;
    this.lives--;
    this.invulnerable = 2;
    const maximumHealth = 8 + this.level * 3;
    this.enemy.health = Math.min(maximumHealth, this.enemy.health + 1);
    this.events.push({
      kind: "hurt",
      text: "Poison hit! Jellyfish recovers +1 health.",
    });
    if (this.lives <= 0) {
      this.status = "lost";
      this.reason =
        "No lives left. Use the fish shield and clean up for hearts.";
    }
    return true;
  }
  isPlaying() {
    return this.status === "playing" && !this.paused;
  }
  // I update the timers, attacks and items here.
  tick(seconds) {
    if (!this.isPlaying()) return;
    this.elapsed += seconds;
    let venomStep = seconds;
    if (this.slowTime > 0) venomStep = seconds * 0.4;
    this.magnetTime = Math.max(0, this.magnetTime - seconds);
    this.slowTime = Math.max(0, this.slowTime - seconds);
    this.updateMagnet(seconds);
    this.shotCooldown = Math.max(0, this.shotCooldown - seconds);
    this.invulnerable = Math.max(0, this.invulnerable - seconds);
    this.shield = Math.max(0, this.shield - seconds);
    this.boostCooldown = Math.max(0, this.boostCooldown - seconds);
    this.enemy.stun = Math.max(0, this.enemy.stun - seconds);
    this.updateEnemy(seconds);
    this.updateShots(seconds);
    if (this.status !== "playing") return;
    this.updatePoison(venomStep);
    this.updateItems(seconds);
    if (this.elapsed >= LEVEL_SECONDS && this.status === "playing")
      this.finishLevel();
  }
  finishLevel() {
    if (this.level === ZONES.length - 1) this.status = "won";
    else this.status = "level-complete";
  }
  updateMagnet(seconds) {
    if (this.magnetTime > 0) {
      for (const item of this.items) {
        if (item.type === "puffer" || item.type === "shield") continue;
        if (
          Math.abs(item.x - this.player.x) < 24 &&
          Math.abs(item.y - this.player.y) < 32
        ) {
          const pull = Math.min(1, seconds * 4);
          item.x += (this.player.x - item.x) * pull;
          item.y += (this.player.y - item.y) * pull;
        }
      }
    }
  }
  updateEnemy(seconds) {
    this.enemy.y =
      39 + Math.sin(this.elapsed * (0.65 + this.level * 0.12)) * 22;
    this.enemy.y = Math.max(
      this.enemyTop,
      Math.min(this.enemyBottom, this.enemy.y),
    );
    if (this.enemy.stun === 0) {
      this.fireTimer -= seconds;
      if (this.fireTimer <= 0) {
        this.fireTimer += this.attackInterval;
        const angle = Math.atan2(
          this.player.y - this.enemy.y,
          this.player.x - this.enemy.x,
        );
        const speed = this.poisonSpeed;
        this.poison.push({
          id: this.serial++,
          x: this.enemy.x - 4,
          y: this.enemy.y,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          active: true,
        });
        this.events.push({ kind: "attack", text: "Poison incoming!" });
      }
    }
  }
  updateShots(seconds) {
    for (const shot of this.shots) {
      shot.x += seconds * 66;
      if (shot.x > 105) shot.active = false;
      if (
        shot.active &&
        this.enemy.stun === 0 &&
        Math.abs(shot.x - this.enemy.x) < 8 &&
        Math.abs(shot.y - this.enemy.y) < 16
      ) {
        shot.active = false;
        this.enemy.health--;
        this.events.push({ kind: "hit", text: "Bubble hit!" });
        if (this.enemy.health <= 0) {
          this.enemy.health = 0;
          this.poison = [];
          this.stuns++;
          this.score += 25;
          this.finishLevel();
          this.events.push({
            kind: "defeat",
            text: "Jellyfish defeated! Diving deeper.",
          });
          break;
        }
      }
    }
  }
  updatePoison(venomStep) {
    for (const orb of this.poison) {
      orb.x += orb.dx * venomStep;
      orb.y += orb.dy * venomStep;
      if (orb.x < -5 || orb.x > 105 || orb.y < -5 || orb.y > 105)
        orb.active = false;
      for (const shot of this.shots) {
        if (
          orb.active &&
          shot.active &&
          Math.abs(shot.x - orb.x) < 5 &&
          Math.abs(shot.y - orb.y) < 8
        ) {
          orb.active = false;
          shot.active = false;
          this.events.push({ kind: "block", text: "Poison blocked!" });
        }
      }
      if (
        orb.active &&
        Math.abs(orb.x - this.player.x) < 6 &&
        Math.abs(orb.y - this.player.y) < 10
      ) {
        orb.active = false;
        this.hurt();
      }
    }
    const shots = [];
    for (const shot of this.shots) if (shot.active) shots.push(shot);
    this.shots = shots;
    const poison = [];
    for (const orb of this.poison) if (orb.active) poison.push(orb);
    this.poison = poison;
  }
  updateItems(seconds) {
    for (let i = this.items.length - 1; i >= 0; i--)
      this.collect(this.items[i].id);
    // I add two floating shields during each 30-second level.
    const dropTimes = [3, 18];
    while (
      this.shieldDrops < dropTimes.length &&
      this.elapsed >= dropTimes[this.shieldDrops]
    ) {
      this.items.push({
        id: this.serial++,
        type: "shield",
        x: 38 + this.shieldDrops * 20,
        y: 28,
      });
      this.shieldDrops++;
    }
    for (const item of this.items) {
      if (item.type === "shield")
        item.y = 28 + Math.sin(this.elapsed * 1.5 + item.id) * 4;
    }
    // I add more items while the level is running.
    const remaining = [];
    for (const item of this.items) {
      if (item.expires === undefined || item.expires > this.elapsed)
        remaining.push(item);
    }
    this.items = remaining;
    const supplies = [
      "bottle",
      "star",
      "bag",
      "shell",
      "seahorse",
      "bottle",
      "conch",
      "bag",
      "star",
    ];
    while (
      this.supplyWave < supplies.length &&
      this.elapsed >= 3 + this.supplyWave * 3
    ) {
      this.spawnItem(supplies[this.supplyWave]);
      this.supplyWave++;
    }
    const hazardCount = 2 + this.level;
    while (
      this.hazardWave < hazardCount &&
      this.elapsed >= 6 + this.hazardWave * (22 / hazardCount)
    ) {
      this.spawnItem("puffer");
      this.hazardWave++;
    }
    for (const item of this.items)
      if (item.type === "puffer")
        item.y = Math.max(
          40,
          Math.min(
            84,
            item.y + Math.sin(this.elapsed * 2 + item.id) * seconds * 10,
          ),
        );
  }
  nextLevel() {
    if (this.status !== "level-complete" || this.lives < 1) return false;
    this.level++;
    this.beginLevel();
    return true;
  }
  result() {
    return {
      id: this.id,
      character: this.character,
      rulesVersion: 2,
      score: Math.min(2500, this.score),
      pearls: Math.min(180, this.pearls),
      lives: this.lives,
      level: this.level,
      completed: this.status === "won",
      correct: this.correct,
      stuns: this.stuns,
    };
  }
}
