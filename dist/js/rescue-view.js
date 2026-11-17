/**
 * AI assistance helped connect the survival rules, input and continuous ocean.
 * Rules stay in rescue-engine.js; HTTP and SQLite stay in their own modules.
 * Sprites are image assets, not a 3D library.
 */
import {
  RescueEngine,
  ZONES,
  DEPTHS,
  CHARACTERS,
  LEVEL_SECONDS,
} from "./rescue-engine.js";
import { fetchQuestion } from "./fish-api.js";
import { BONUSES, findBonus } from "./workshop.js";
import { getUser, serverAction } from "./storage.js";
let closeCurrent = null;
let running = false;
export function isRescueActive() {
  return running;
}
export function stopRescue(ask = false) {
  if (
    ask &&
    running &&
    !window.confirm("Leave this dive? Unfinished progress will not be saved.")
  )
    return false;
  if (closeCurrent) closeCurrent();
  return true;
}
function art(name, extra = "", label = "") {
  let family = "rescue-art art-";
  if (["jellyboss", "star", "conch", "venom"].includes(name))
    family = "venom-art venom-";
  if (["turtle", "fish", "mermaid", "puffer"].includes(name))
    family = "crew-art crew-";
  if (name === "seahorse") family = "seahorse-art art-";
  return `<span class="${family}${name} ${extra}" role="img" aria-label="${label}"></span>`;
}
function button(label, action, extra = "") {
  return `<button class="rescue-button ${extra}" data-rescue="${action}">${label}</button>`;
}
function bonusImage(id, extra = "") {
  return `<img class="workshop-pack-image ${extra}" src="assets/rescue/workshop-${id}.png" alt="" decoding="async">`;
}
function directionForKey(key) {
  if (key === "arrowleft" || key === "a") return "left";
  if (key === "arrowright" || key === "d") return "right";
  if (key === "arrowup" || key === "w") return "up";
  if (key === "arrowdown" || key === "s") return "down";
  return "";
}
export function openRescue(
  root,
  userId,
  onExit,
  initialScreen = "select",
  onLayout = function () {},
) {
  let game = null;
  let screen = "intro";
  let alive = true;
  let animation;
  let controller;
  let previousTime = performance.now();
  let keys = { left: false, right: false, up: false, down: false };
  let firing = false;
  let destination = null;
  let depth = 20;
  let targetDepth = 20;
  let descent = 0;
  let messageTime = 0;
  let saved = false;
  let saving = false;
  let saveError = "";
  let enemyFlash = 0;
  let loadError = false;
  let boostLoading = false;
  let boostOpen = false;
  let selectedCharacter = "turtle";
  let workshopBusy = false;
  let starting = false;
  const savedAccount = getUser(userId);
  for (const character of CHARACTERS) {
    if (savedAccount.rescue && savedAccount.rescue.captain === character.id) {
      selectedCharacter = character.id;
    }
  }
  const reduced = savedAccount.settings.reducedMotion;
  function profile() {
    return getUser(userId).rescue || { restored: [], runs: [] };
  }
  function intro() {
    screen = "intro";
    let choices = "";
    for (const character of CHARACTERS) {
      choices +=
        '<button class="crew-choice" data-rescue="character-' +
        character.id +
        '" aria-pressed="' +
        (selectedCharacter === character.id) +
        '">' +
        art(character.id, "", character.kind + " submarine pilot") +
        "<strong>" +
        character.name +
        "</strong></button>";
    }
    root.innerHTML =
      '<div class="survival-intro"><p class="eyebrow">FIVE DEPTHS · THREE LIVES</p><h1>Choose your ocean hero.</h1><div class="crew-choices">' +
      choices +
      '</div><div class="intro-rules"><span>♥ ♥ ♥<small>Survive 30s or defeat the jellyfish</small></span><span>Fish shield<small>Correct count = 10s protection</small></span><span>Clean ocean<small>2 plastic items = +1 heart</small></span></div><p>Collect treasures · avoid spiny fish · survive the abyss</p><div class="rescue-actions">' +
      button("Start dive →", "start") +
      button("Workshop", "reef", "secondary") +
      button("Home", "home", "secondary") +
      '</div><p class="small muted">Arrows / WASD · Space to shoot · collect floating shields</p></div>';
    onLayout();
  }
  function reef() {
    screen = "reef";
    const workshop = profile().workshop || { prepared: null };
    const packed = findBonus(workshop.prepared);
    const pearls = getUser(userId).pearls;
    let tools = "";
    for (const bonus of BONUSES) {
      const selected = workshop.prepared === bonus.id;
      tools +=
        '<article class="workshop-tool ' +
        (selected ? "packed" : "") +
        '"><span class="workshop-icon" aria-hidden="true">' +
        bonusImage(bonus.id) +
        "</span><h2>" +
        bonus.name +
        "</h2><p>" +
        bonus.description +
        '</p><button class="rescue-button" data-rescue="buy-' +
        bonus.id +
        '" ' +
        (packed || pearls < bonus.price ? "disabled" : "") +
        ">" +
        (selected ? "✓ PACKED" : bonus.price + " ◉ · PACK") +
        "</button></article>";
    }
    root.innerHTML =
      '<section class="workshop"><header><div><p class="eyebrow">MY REEF · SUBMARINE WORKSHOP</p><h1>Ready for your next dive?</h1></div><strong class="workshop-wallet">' +
      pearls +
      ' ◉</strong></header><div class="workshop-preview">' +
      art(selectedCharacter, "", "Your submarine") +
      '<span class="workshop-loadout">' +
      (packed
        ? bonusImage(packed.id, "workshop-thumbnail") + packed.name + " packed"
        : "Choose one dive bonus") +
      '</span></div><div class="workshop-tools">' +
      tools +
      '</div><p id="survival-message" role="status"></p><p class="small muted">One bonus per dive · activate once with E or the bonus button.<br>Your pack is spent when a dive starts, even if you leave. Buy another for your next dive.</p><div class="rescue-actions">' +
      button("Choose captain →", "intro") +
      button("Home", "home", "secondary") +
      "</div></section>";
    onLayout();
  }
  async function useWorkshopBonus() {
    if (
      !game ||
      screen !== "game" ||
      game.paused ||
      descent > 0 ||
      game.status !== "playing" ||
      !game.bonus ||
      game.bonusUsed ||
      workshopBusy
    )
      return;
    const dive = game;
    workshopBusy = true;
    try {
      await serverAction(userId, "workshop-use", { diveId: dive.id });
      if (alive && game === dive && descent === 0) dive.useBonus();
    } catch (error) {
      notice(error.message);
    } finally {
      workshopBusy = false;
    }
  }
  function world() {
    let html =
      '<div class="survival-haze"></div><div class="survival-far"></div><div class="survival-world" id="survival-world">';
    const scenery = [
      ["plant", "coral", "rock"],
      ["coral", "rock", "plant"],
      ["rock", "jelly", "conch"],
      ["rock", "conch", "plant"],
      ["jelly", "rock", "conch"],
    ];
    for (let zone = 0; zone < ZONES.length; zone++) {
      html +=
        '<div class="survival-region region-' +
        zone +
        '" style="top:' +
        zone * 20 +
        '%">';
      for (let i = 0; i < 8; i++)
        html += art(scenery[zone][i % 3], "scenery scenery-" + i);
      html += '<div class="survival-sand"></div></div>';
    }
    return (
      html +
      '</div><div class="survival-near">' +
      art("coral") +
      art("rock") +
      '</div><div class="water-stream"><i></i><i></i><i></i><i></i></div>'
    );
  }
  function fitOcean() {
    const scene = root.querySelector(".survival-game");
    if (!scene) return;
    const top = Math.round(scene.getBoundingClientRect().top + window.scrollY);
    scene.style.setProperty("--game-top", top + "px");
    if (!game) return;
    const stage = root.querySelector(".survival-stage");
    const player = root.querySelector("#survival-player");
    const enemy = root.querySelector("#survival-enemy");
    const area = stage.getBoundingClientRect();
    if (!area.width || !area.height) return;
    const side = Math.min(25, (player.offsetWidth / area.width) * 50 + 1);
    const vertical = Math.min(40, (player.offsetHeight / area.height) * 50 + 1);
    game.bounds = {
      left: side,
      right: Math.min(74, 100 - side),
      top: vertical,
      bottom: 100 - vertical,
    };
    game.player.x = Math.max(
      game.bounds.left,
      Math.min(game.bounds.right, game.player.x),
    );
    game.player.y = Math.max(
      game.bounds.top,
      Math.min(game.bounds.bottom, game.player.y),
    );
    game.enemy.x = Math.min(87, 99 - (enemy.offsetWidth / area.width) * 50);
    game.enemyTop = Math.min(40, (enemy.offsetHeight / area.height) * 50 + 1);
    game.enemyBottom = 100 - game.enemyTop;
    game.enemy.y = Math.max(
      game.enemyTop,
      Math.min(game.enemyBottom, game.enemy.y),
    );
  }
  const sizeObserver = new ResizeObserver(fitOcean);
  sizeObserver.observe(root);
  window.addEventListener("resize", fitOcean);
  function mountOcean() {
    screen = "game";
    root.innerHTML =
      '<div class="survival-game"><header class="survival-hud"><div><span id="survival-lives" aria-label="Lives"></span><strong id="survival-zone"></strong></div><div class="survival-clock"><strong id="survival-clock"></strong><span id="survival-depth"></span></div><div class="survival-resources"><span id="survival-ammo"></span><span id="survival-pearls"></span>' +
      button("Ⅱ", "pause", "icon-button") +
      '</div></header><div class="survival-goals" id="survival-goals"></div><div class="survival-stage" id="survival-stage">' +
      world() +
      '<div id="survival-player" class="survival-player">' +
      art(selectedCharacter, "", "Your " + selectedCharacter + " submarine") +
      '<span class="workshop-accessory" aria-hidden="true"></span><span class="shield-bubble"></span><span class="bubble-gun"></span><span class="engine-stream"><i></i><i></i></span></div><div id="survival-enemy" class="survival-enemy">' +
      art("jellyboss", "", "Jellyfish enemy firing poison") +
      '<div class="enemy-health"><span id="enemy-health"></span></div><span id="enemy-state"></span></div><div id="survival-items"></div><div id="survival-poison"></div><div id="survival-shots"></div><div id="survival-fish" class="survival-fish"></div><button class="workshop-trigger" data-rescue="use-workshop" hidden></button><div id="swim-target" class="swim-target"></div><div id="survival-banner" class="survival-banner" role="status"></div></div><div id="survival-message" class="survival-message" role="status"></div><div id="survival-answers" class="survival-answers"></div><div class="survival-controls"><div class="swim-pad"><button data-swim="left" aria-label="Swim left">←</button><button data-swim="up" aria-label="Swim up">↑</button><button data-swim="down" aria-label="Swim down">↓</button><button data-swim="right" aria-label="Swim right">→</button></div><button class="fire-button" data-rescue="shoot" aria-label="Fire bubble gun">◉ SHOOT</button></div><div id="survival-overlay"></div></div>';
    onLayout();
  }
  async function start() {
    if (starting) return;
    starting = true;
    try {
      await serverAction(userId, "captain", { captain: selectedCharacter });
      if (!alive) return;
      game = new RescueEngine(Math.random, selectedCharacter);
      await serverAction(userId, "workshop-launch", { diveId: game.id });
      if (!alive) return;
      const active = profile().workshop.active;
      if (active && active.diveId === game.id && active.bonus)
        game.equipBonus(active.bonus);
      running = true;
      depth = 20;
      targetDepth = 20;
      descent = 0;
      saved = false;
      saving = false;
      saveError = "";
      boostOpen = false;
      boostLoading = false;
      mountOcean();
      sizeObserver.observe(root.querySelector(".survival-stage"));
      fitOcean();
      updateFish();
      render();
      notice(
        "Survive 30 seconds or defeat the jellyfish. Collect floating shields.",
        4,
      );
    } catch (error) {
      running = false;
      game = null;
      intro();
      const message = document.createElement("p");
      message.setAttribute("role", "status");
      if (error.message === "Unknown action") {
        message.textContent =
          "The game server needs restarting after the update. Restart it and sign in again.";
      } else {
        message.textContent =
          error.message || "Could not start the dive. Please try again.";
      }
      root.appendChild(message);
    } finally {
      starting = false;
    }
  }
  async function loadQuestion() {
    if (
      !game ||
      screen !== "game" ||
      game.status !== "playing" ||
      game.paused ||
      descent > 0
    )
      return;
    if (game.boostReady) {
      boostOpen = true;
      updateFish();
      return;
    }
    if (boostLoading || game.boostTokens < 1 || game.boostCooldown > 0) return;
    boostOpen = true;
    boostLoading = true;
    loadError = false;
    if (controller) controller.abort();
    const request = new AbortController();
    controller = request;
    const currentGame = game;
    const level = game.level;
    updateFish();
    try {
      const question = await fetchQuestion(request.signal);
      if (
        !alive ||
        currentGame !== game ||
        level !== game.level ||
        request !== controller ||
        screen !== "game"
      )
        return;
      game.load(question);
      boostLoading = false;
      updateFish();
      notice("Correct count = 10 seconds of protection. Poison stays live!", 4);
    } catch (error) {
      if (!alive || request.signal.aborted || request !== controller) return;
      boostLoading = false;
      loadError = true;
      updateFish();
      notice("Shield fish could not load. Try again.", 4);
    }
  }
  function updateFish() {
    if (screen !== "game") return;
    const fish = root.querySelector("#survival-fish");
    const answers = root.querySelector("#survival-answers");
    fish.innerHTML = "";
    answers.innerHTML = "";
    fish.classList.toggle("count-finished", !boostOpen);
    if (!boostOpen) return;
    if (boostLoading) {
      fish.innerHTML =
        '<span class="loader"></span><span>Finding shield fish…</span>';
    } else if (loadError) {
      fish.innerHTML = button("Retry shield fish", "retry");
    } else if (game.boostReady) {
      for (let i = 0; i < game.answer; i++)
        fish.innerHTML +=
          '<button class="s-count-fish" data-rescue="mark-' +
          i +
          '" aria-label="Mark fish ' +
          (i + 1) +
          '"><img src="assets/fish.svg" alt="Fish"></button>';
      for (let i = 0; i < 10; i++)
        answers.innerHTML += button(String(i), "answer-" + i, "answer-key");
    }
    answers.innerHTML += button("×", "close-boost", "close-boost");
  }
  function notice(text, seconds = 2) {
    const label = root.querySelector("#survival-message");
    if (label) label.textContent = text;
    messageTime = seconds;
  }
  function syncObjects(containerId, objects, kind) {
    const container = root.querySelector(containerId);
    const active = [];
    for (const object of objects) {
      active.push(String(object.id));
      let node = container.querySelector('[data-id="' + object.id + '"]');
      if (!node) {
        node = document.createElement(kind === "item" ? "button" : "span");
        node.dataset.id = object.id;
        node.className =
          "survival-object object-" +
          kind +
          (object.type === "puffer" ? " hazard-item" : "");
        if (kind === "item") {
          node.dataset.pickup = object.id;
          node.setAttribute("aria-label", "Swim to collect " + object.type);
          node.innerHTML =
            object.type === "shield"
              ? '<span class="floating-shield" role="img" aria-label="Fish shield booster">🛡<small>🐟</small></span>'
              : art(object.type);
        }
        if (kind === "poison") node.innerHTML = art("venom");
        container.appendChild(node);
      }
      node.style.left = object.x + "%";
      node.style.top = object.y + "%";
    }
    for (const node of [...container.children])
      if (!active.includes(node.dataset.id)) node.remove();
  }
  function render() {
    if (!game || screen !== "game") return;
    let hearts = "";
    for (let i = 0; i < 3; i++)
      hearts +=
        '<span class="' + (i < game.lives ? "" : "empty-life") + '">♥</span>';
    root.querySelector("#survival-lives").innerHTML = hearts;
    root.querySelector("#survival-zone").textContent =
      game.level + 1 + "/5 · " + ZONES[game.level];
    root.querySelector("#survival-clock").textContent =
      game.status === "loading"
        ? "Waiting…"
        : Math.ceil(Math.max(0, LEVEL_SECONDS - game.elapsed)) + "s";
    root.querySelector("#survival-depth").textContent = Math.round(depth) + "m";
    root.querySelector("#survival-ammo").textContent =
      "◉ " + game.ammo + " shots";
    root.querySelector("#survival-pearls").textContent =
      game.pearls + " pearls";
    root.querySelector("#survival-goals").innerHTML =
      "<span>Clean " +
      game.cleanMeter +
      "/2 → ♥</span><span>" +
      game.treasures +
      ' treasures</span><span class="shield-timer">' +
      (game.shield > 0
        ? "SHIELD " + Math.ceil(game.shield) + "s"
        : "Avoid spiny fish") +
      "</span>";
    const bonus = findBonus(game.bonus);
    const trigger = root.querySelector(".workshop-trigger");
    trigger.hidden = !bonus;
    if (bonus) {
      let label = game.bonusUsed ? "USED" : "USE · E";
      if (game.magnetTime > 0) label = Math.ceil(game.magnetTime) + "s";
      if (game.slowTime > 0) label = Math.ceil(game.slowTime) + "s";
      if (trigger.dataset.bonus !== bonus.id) {
        trigger.innerHTML =
          bonusImage(bonus.id, "workshop-thumbnail") +
          '<span class="workshop-trigger-label"></span>';
        trigger.dataset.bonus = bonus.id;
      }
      trigger.querySelector(".workshop-trigger-label").textContent =
        bonus.name + " · " + label;
      trigger.disabled =
        workshopBusy || game.bonusUsed || game.paused || descent > 0;
    }
    const player = root.querySelector("#survival-player");
    const accessory = player.querySelector(".workshop-accessory");
    if (accessory.dataset.bonus !== (game.bonus || "")) {
      accessory.innerHTML = bonus ? bonusImage(bonus.id) : "";
      accessory.dataset.bonus = game.bonus || "";
    }
    player.classList.toggle("magnet-active", game.magnetTime > 0);
    root
      .querySelector(".survival-stage")
      .classList.toggle("slow-venom", game.slowTime > 0);
    player.style.left = game.player.x + "%";
    player.style.top = game.player.y + "%";
    player.classList.toggle("protected", game.invulnerable > 0);
    player.classList.toggle("shielded", game.shield > 0);
    const enemy = root.querySelector("#survival-enemy");
    enemy.style.left = game.enemy.x + "%";
    enemy.style.top = game.enemy.y + "%";
    enemy.classList.toggle("stunned", game.enemy.stun > 0);
    enemy.classList.toggle("firing", enemyFlash > 0);
    root.querySelector("#enemy-health").style.width =
      (game.enemy.health / (8 + game.level * 3)) * 100 + "%";
    root.querySelector("#enemy-state").textContent =
      game.enemy.stun > 0
        ? "Stunned " + Math.ceil(game.enemy.stun) + "s"
        : "VENOM JELLY";
    syncObjects("#survival-items", game.items, "item");
    syncObjects("#survival-poison", game.poison, "poison");
    syncObjects("#survival-shots", game.shots, "shot");
    let camera = 0;
    for (let i = 0; i < DEPTHS.length - 1; i++) {
      if (depth >= DEPTHS[i])
        camera =
          i + Math.min(1, (depth - DEPTHS[i]) / (DEPTHS[i + 1] - DEPTHS[i]));
    }
    root.querySelector("#survival-world").style.transform =
      "translateY(" + (-camera * 100) / 5 + "%)";
    const scene = root.querySelector(".survival-game");
    scene.style.setProperty("--sea-depth", camera / 4);
    scene.classList.toggle("is-diving", descent > 0);
    scene.classList.toggle("is-paused", game.paused);
    scene.classList.toggle("no-ammo", game.ammo === 0);
    root.querySelector("#survival-banner").textContent =
      descent > 0 ? "↓ " + ZONES[Math.min(4, game.level + 1)] : "";
    const target = root.querySelector("#swim-target");
    target.hidden = !destination;
    if (destination) {
      target.style.left = destination.x + "%";
      target.style.top = destination.y + "%";
    }
    for (const key of root.querySelectorAll(".answer-key"))
      key.disabled = game.paused || descent > 0 || game.status !== "playing";
  }
  function pause() {
    if (!game || screen !== "game") return;
    game.paused = !game.paused;
    stopInput();
    root.querySelector("#survival-overlay").innerHTML = game.paused
      ? '<div class="survival-pause"><section role="dialog" aria-label="Dive paused"><h2>Dive paused</h2>' +
        button("Resume", "pause") +
        button("Leave dive", "home", "secondary") +
        "</section></div>"
      : "";
    render();
  }
  async function saveResult() {
    if (saving || saved) return;
    saving = true;
    saveError = "";
    const current = game;
    try {
      await serverAction(userId, "survival", { result: current.result() });
      if (game === current) saved = true;
    } catch (error) {
      if (game === current)
        saveError = "Not saved. Check your connection and retry.";
    }
    if (game === current) {
      saving = false;
      if (alive && screen === "result") resultScreen();
    }
  }
  function resultScreen() {
    screen = "result";
    running = false;
    stopInput();
    const won = game.status === "won";
    root.innerHTML =
      '<div class="survival-results"><p class="eyebrow">' +
      (won ? "DEEP SEA RESCUED" : "DIVE ENDED") +
      "</p><h1>" +
      (won ? "You survived the depths!" : "Try another dive, captain.") +
      '</h1><div class="result-art">' +
      art(selectedCharacter) +
      art(won ? "chest" : "jellyboss") +
      '</div><div class="survival-summary"><span>♥ ' +
      game.lives +
      "/3</span><span>" +
      game.pearls +
      " ◉</span><span>" +
      game.score +
      " points</span></div><p>" +
      (won ? "All five depths complete." : game.reason) +
      '</p><p role="status">' +
      (saved ? "Account progress saved." : saveError || "Saving…") +
      '</p><div class="rescue-actions">' +
      (saveError ? button("Retry save", "save") : "") +
      button("Dive again", "intro") +
      button("Workshop", "reef", "secondary") +
      button("Home", "home", "secondary") +
      "</div></div>";
    if (!saved && !saving && !saveError) saveResult();
    onLayout();
  }
  function consumeEvents() {
    while (game.events.length) {
      const event = game.events.shift();
      if (event.kind === "attack") enemyFlash = 0.7;
      else {
        if (event.kind === "booster") loadQuestion();
        notice(event.text);
        if (event.kind === "hurt")
          root.querySelector(".survival-stage").classList.add("poison-flash");
      }
    }
  }
  async function click(event) {
    const pickup = event.target.closest("[data-pickup]");
    if (pickup && game && !game.paused && game.status === "playing") {
      const item = game.items.find(function (item) {
        return item.id === Number(pickup.dataset.pickup);
      });
      if (item && item.type === "puffer") {
        notice("Spiny fish! Avoid it: -10 points, -2 pearls.");
        return;
      }
      if (item) destination = { x: item.x, y: item.y };
      return;
    }
    const node = event.target.closest("[data-rescue]");
    if (!node || !root.contains(node)) return;
    const action = node.dataset.rescue;
    try {
      if (action.startsWith("character-")) {
        selectedCharacter = action.slice(10);
        for (const choice of root.querySelectorAll(".crew-choice"))
          choice.setAttribute("aria-pressed", choice === node);
      } else if (action === "start") {
        node.disabled = true;
        await start();
      } else if (action.startsWith("buy-")) {
        if (workshopBusy) return;
        workshopBusy = true;
        node.disabled = true;
        try {
          await serverAction(userId, "workshop-buy", {
            bonus: action.slice(4),
          });
          if (alive && screen === "reef") {
            reef();
            notice("Packed! Ready for your next dive.");
          }
        } finally {
          workshopBusy = false;
          if (node.isConnected) node.disabled = false;
        }
      } else if (action === "use-workshop") {
        await useWorkshopBonus();
      } else if (action === "home") {
        if (stopRescue(true)) onExit();
      } else if (action === "intro") intro();
      else if (action === "reef") reef();
      else if (action === "pause") pause();
      else if (action === "retry" || action === "boost") await loadQuestion();
      else if (action === "close-boost") {
        boostOpen = false;
        updateFish();
      } else if (action === "save") await saveResult();
      else if (action.startsWith("plant-")) {
        await serverAction(userId, "restore", {
          spot: Number(action.slice(6)),
        });
        reef();
        notice("Your reef is growing!");
      } else if (
        game &&
        !game.paused &&
        descent === 0 &&
        game.status === "playing"
      ) {
        if (action === "shoot") {
          if (!game.shoot() && game.ammo === 0)
            notice("Collect a pearl or count fish for ammo.");
        } else if (action.startsWith("answer-")) {
          submitAnswer(
            Number(action.slice(7)),
            "Look closely. Try another number.",
          );
        } else if (action.startsWith("mark-")) {
          node.classList.add("marked");
          node.setAttribute("aria-pressed", "true");
        }
      }
    } catch (error) {
      notice(error.message);
    }
  }
  function submitAnswer(number, wrongMessage) {
    const outcome = game.answerNumber(number);
    if (outcome === "wrong") notice(wrongMessage);
    if (outcome === "correct") {
      boostOpen = false;
      updateFish();
    }
  }
  function keyDown(event) {
    if (
      !game ||
      screen !== "game" ||
      event.target.matches("input,textarea,select") ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const name = event.key.toLowerCase();
    if (name === "e" && !event.repeat) {
      event.preventDefault();
      useWorkshopBonus();
      return;
    }
    if ((name === "p" || name === "escape") && !event.repeat) {
      event.preventDefault();
      pause();
      return;
    }

    const direction = directionForKey(name);
    if (direction) {
      event.preventDefault();
      keys[direction] = true;
      destination = null;
    }
    if (event.code === "Space") {
      event.preventDefault();
      firing = true;
    }

    if (/^[0-9]$/.test(name) && !event.repeat && descent === 0 && boostOpen) {
      submitAnswer(Number(name), "Try another number.");
    }
  }
  function keyUp(event) {
    const direction = directionForKey(event.key.toLowerCase());
    if (direction) keys[direction] = false;
    if (event.code === "Space") firing = false;
  }
  function stopInput() {
    keys = { left: false, right: false, up: false, down: false };
    firing = false;
  }
  function pointerDown(event) {
    if (!game || screen !== "game" || game.paused) return;
    const direction = event.target.closest("[data-swim]");
    if (direction) {
      event.preventDefault();
      keys[direction.dataset.swim] = true;
      destination = null;
      return;
    }
    if (event.target.closest(".fire-button")) {
      event.preventDefault();
      firing = true;
      return;
    }
    if (event.target.closest("button")) return;
    const stage = root.querySelector("#survival-stage");
    if (stage.contains(event.target)) {
      const rect = stage.getBoundingClientRect();
      destination = {
        x: Math.max(
          game.bounds.left,
          Math.min(
            game.bounds.right,
            ((event.clientX - rect.left) / rect.width) * 100,
          ),
        ),
        y: Math.max(
          game.bounds.top,
          Math.min(
            game.bounds.bottom,
            ((event.clientY - rect.top) / rect.height) * 100,
          ),
        ),
      };
    }
  }
  function hidden() {
    if (game && running && document.hidden && !game.paused) pause();
  }
  function frame(now) {
    if (!alive) return;
    const seconds = Math.min(0.05, (now - previousTime) / 1000);
    previousTime = now;
    if (game && screen === "game") {
      if (!game.paused) {
        enemyFlash = Math.max(0, enemyFlash - seconds);
        messageTime = Math.max(0, messageTime - seconds);
        if (messageTime === 0) {
          notice("", 0);
          root
            .querySelector(".survival-stage")
            .classList.remove("poison-flash");
        }
        if (descent > 0) {
          descent = Math.max(0, descent - seconds);
          depth += (targetDepth - depth) * Math.min(1, seconds * 1.8);
          if (descent === 0) {
            depth = targetDepth;
            game.nextLevel();
            destination = null;
            boostOpen = false;
            boostLoading = false;
            updateFish();
          }
        } else if (game.status === "playing") {
          let dx = 0;
          let dy = 0;
          if (keys.right) dx++;
          if (keys.left) dx--;
          if (keys.down) dy++;
          if (keys.up) dy--;
          if (destination) {
            dx = Math.sign(destination.x - game.player.x);
            dy = Math.sign(destination.y - game.player.y);
            if (Math.abs(destination.x - game.player.x) < 1.5) dx = 0;
            if (Math.abs(destination.y - game.player.y) < 2) dy = 0;
            if (dx === 0 && dy === 0) destination = null;
          }
          if (dx && dy) {
            dx *= 0.707;
            dy *= 0.707;
          }
          game.move(dx, dy, seconds);
          if (firing) game.shoot();
          game.tick(seconds);
          if (
            game.boostTokens > 0 &&
            !game.boostReady &&
            !boostOpen &&
            !boostLoading &&
            game.boostCooldown === 0
          )
            loadQuestion();
          consumeEvents();
          if (game.status === "level-complete") {
            targetDepth = DEPTHS[game.level + 1];
            if (controller) controller.abort();
            boostOpen = false;
            boostLoading = false;
            updateFish();
            descent = reduced ? 0.01 : 3;
            stopInput();
            notice(
              game.enemy.health === 0
                ? "Jellyfish defeated! Diving deeper…"
                : "You survived! Diving deeper…",
              3,
            );
          }
          if (game.status === "lost" || game.status === "won") resultScreen();
        }
      }
      if (screen === "game") render();
    }
    animation = requestAnimationFrame(frame);
  }
  root.addEventListener("click", click);
  root.addEventListener("pointerdown", pointerDown);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("pointerup", stopInput);
  window.addEventListener("pointercancel", stopInput);
  document.addEventListener("visibilitychange", hidden);
  closeCurrent = function () {
    alive = false;
    running = false;
    cancelAnimationFrame(animation);
    sizeObserver.disconnect();
    window.removeEventListener("resize", fitOcean);
    if (controller) controller.abort();
    root.removeEventListener("click", click);
    root.removeEventListener("pointerdown", pointerDown);
    window.removeEventListener("keydown", keyDown);
    window.removeEventListener("keyup", keyUp);
    window.removeEventListener("pointerup", stopInput);
    window.removeEventListener("pointercancel", stopInput);
    document.removeEventListener("visibilitychange", hidden);
    closeCurrent = null;
  };
  if (initialScreen === "reef") reef();
  else intro();
  animation = requestAnimationFrame(frame);
}
