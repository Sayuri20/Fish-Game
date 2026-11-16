/*
 * AI assistance was used to simplify this UI controller and its event handlers.
 * Existing PearlPop markup, CSS and artwork are retained from the supplied ZIP.
 * GameGUI.java and LoginGUI.java (Marc Conrad's teaching example) inspired the
 * separation between the interface, game engine, HTTP service and login data.
 */
import { GameEngine } from "./game-engine.js";
import { fetchQuestion } from "./fish-api.js";
import * as auth from "./auth.js";
import * as storage from "./storage.js";
import { playTone } from "./audio.js";

let state = {
  user: null,
  screen: "hub",
  game: null,
  source: "live",
  modal: null,
  feedback: null,
  loadError: false,
  authBusy: false,
  formError: "",
  lastResult: null,
  pendingNav: null,
};
let request = null;
let feedbackTimer = null;
let toastTimer = null;
let questionStarted = 0;
let reminderShown = false;
let advanceTimer = null;

// Reconstructed from the requested chat changes with AI assistance.
function backButton() {
  if (state.user === null || state.screen === "hub") return "";
  let destination = "modes";
  if (state.screen === "modes") destination = "hub";
  return button("&#8592; Back to play", destination, "lilac back-to-play");
}
function oceanDecor() {
  let bubbles = "";
  for (let i = 0; i < 10; i++) {
    bubbles += '<i class="water-bubble" style="--i:' + i + '"></i>';
  }
  return (
    '<div class="ocean-decoration" aria-hidden="true">' +
    bubbles +
    '<div class="sea-garden"><span>🌿</span><span>🐚</span><span>🦪</span><span class="sea-pearl"></span><span>🌿</span></div></div>'
  );
}

function find(selector) {
  return document.querySelector(selector);
}
function user() {
  return storage.getUser(state.user);
}
function activeGame() {
  if (state.game === null) {
    return false;
  }
  if (state.game.status === "finished" || state.game.status === "ended") {
    return false;
  }
  return true;
}
function escapeText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  let input = String(value);
  let output = "";
  for (let i = 0; i < input.length; i++) {
    let letter = input[i];
    if (letter === "&") {
      output = output + "&amp;";
    } else if (letter === "<") {
      output = output + "&lt;";
    } else if (letter === ">") {
      output = output + "&gt;";
    } else if (letter === '"') {
      output = output + "&quot;";
    } else if (letter === "'") {
      output = output + "&#39;";
    } else {
      output = output + letter;
    }
  }
  return output;
}
function button(label, action, colour, attributes) {
  if (colour === undefined) {
    colour = "mint";
  }
  if (attributes === undefined) {
    attributes = "";
  }
  return `<button class="pearl-button ${colour}" data-action="${action}" ${attributes}>${label}</button>`;
}
function heading(title, subtitle) {
  let smallHeading = "";
  if (subtitle !== undefined && subtitle !== "") {
    smallHeading = `<span class="eyebrow">${subtitle}</span>`;
  }
  return `<div class="page-heading"><div>${smallHeading}<h1>${title}</h1></div></div>`;
}
function pill(label, value, extra) {
  if (extra === undefined) {
    extra = "";
  }
  return `<div class="hud-pill ${extra}"><span>${label}</span><strong>${value}</strong></div>`;
}
function toast(message) {
  find("#toast").textContent = message;
  find("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 3500);
}
function hideToast() {
  find("#toast").classList.remove("visible");
}
function playFeedback(kind) {
  let explorer = user();
  if (explorer !== null) {
    playTone(kind, explorer.settings.sound);
  }
}
function navigate(screen) {
  if (activeGame() && screen !== state.screen) {
    state.game.pause();
    state.pendingNav = screen;
    state.modal = "leave";
    render();
    return;
  }
  state.screen = screen;
  state.modal = null;
  state.formError = "";
  render();
  window.scrollTo(0, 0);
}

// SCREEN HTML: each function prepares a screen without checking game answers.
function accountScreen() {
  let title = "Welcome back";
  let description = "Your lagoon is waiting for you.";
  let passwordType = "current-password";
  let confirmField = "";
  let submitText = "DIVE IN";
  let otherButton = button("NEW EXPLORER", "signup", "lilac full");
  if (state.screen === "signup") {
    title = "Join the reef";
    description = "Your little ocean story starts here.";
    passwordType = "new-password";
    submitText = "CREATE ACCOUNT";
    otherButton = button("BACK TO SIGN IN", "login", "lilac full");
    confirmField = `<label for="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" required placeholder="One more time">`;
  }
  return `<div class="auth-layout">
    <section class="auth-intro"><span class="eyebrow">A LITTLE COUNTING. AN OCEAN OF DISCOVERY.</span>
      <h1>Little counts.<br>Ocean-sized joy.</h1><p>A whole reef of possibilities. Come make a splash.</p>
      <img class="hero-fish float" src="assets/hero-fish.svg" alt="A friendly orange fish">
      <div class="tiny-tag">10 little rounds &middot; 2 ways to play</div></section>
    <section class="panel auth-card"><div class="pearl-mark">&#9673;</div><h2>${title}</h2><p class="muted">${description}</p>
      <form id="account-form"><label for="username">Explorer name</label>
        <input id="username" name="username" autocomplete="username" minlength="3" maxlength="20" required placeholder="Your explorer name">
        <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${passwordType}" minlength="6" required placeholder="At least 6 characters">
        ${confirmField}<p id="form-error" class="form-error" role="alert">${escapeText(state.formError)}</p>
        <button class="pearl-button mint full" type="submit">${submitText}</button></form>
      ${otherButton}</section></div>`;
}
function homeScreen() {
  let explorer = user();
  let best = 0;
  for (let i = 0; i < explorer.history.length; i++) {
    let result = explorer.history[i];
    if (!result.incomplete && result.score > best) {
      best = result.score;
    }
  }
  let correctToday = 0;
  let today = explorer.daily[storage.dayKey()];
  if (today !== undefined) {
    correctToday = Math.min(5, today.correct);
  }
  return `${heading("Your lagoon is waiting.", "HEY, " + escapeText(explorer.name))}
    <div class="home-grid"><section class="panel hero-card"><h2>Make a little<br>splash today.</h2><p>10 rounds. One happy reef.</p>
      ${button("&#9654; &nbsp; LET'S PLAY", "modes", "mint hero-cta")}<img class="home-fish float" src="assets/hero-fish.svg" alt="Friendly orange fish"></section>
    <section class="panel daily-card"><span class="eyebrow peach-text">TODAY'S TINY QUEST</span><strong class="big-number">${correctToday} / 5</strong><p>correct answers today</p>${button("VIEW GOAL", "daily", "peach full")}</section></div>
    <div class="stat-grid"><div class="panel stat-card"><span>PERSONAL BEST</span><strong class="yellow-text">${best} / 10</strong></div>
    <div class="panel stat-card"><span>YOUR PEARLS</span><strong class="mint-text">${explorer.pearls} &#9673;</strong></div>
    <div class="panel stat-card"><span>REEF COLLECTION</span><strong class="lilac-text">${explorer.collection.length} unlocked</strong></div></div>`;
}
function modesScreen() {
  return `${heading("Pick your ocean pace.", "ONE DIVE / TEN ROUNDS")}
    <div class="mode-grid"><section class="panel mode-card"><div class="mode-symbol mint-text">&#8776;</div><h2>Practice</h2><p>No timer.<br>Build your confidence.</p>${button("START PRACTICE", "start-practice", "mint full")}</section>
    <section class="panel mode-card"><div class="mode-symbol peach-text">&#9719;</div><h2>Timed dive</h2><p>10 seconds per round.<br>Find your focus.</p>${button("START TIMED DIVE", "start-timed", "peach full")}</section></div>
    <p class="center muted">+1 for correct &middot; 2 skips per dive &middot; no points for skips or timeouts</p>`;
}
function questionPicture(game) {
  if (game.status === "loading") {
    if (state.loadError) {
      return `<div class="question-state"><span class="state-symbol">&#8776;</span><h2>Lost the current.</h2><p>Could not load the next question.<br>Your score is safe. Check your connection.</p>${button("TRY AGAIN", "retry")}</div>`;
    }
    return `<div class="question-state"><span class="loader" aria-hidden="true"></span><h2>Finding your next reef...</h2><p>The timer starts when the fish are ready.</p></div>`;
  }
  if (game.question === null) {
    return "";
  }
  let fishImages = "";
  for (let i = 0; i < game.question.answer; i++) {
    fishImages =
      fishImages +
      '<span class="fish-arrival" style="--i:' +
      i +
      '"><img src="assets/fish.svg" alt="Fish" draggable="false"></span>';
  }
  return `<div class="counting-fishes count-${game.question.answer}" aria-label="Illustrated fish counting question">${fishImages}${oceanDecor()}</div>`;
}
function twoDigits(number) {
  if (number < 10) {
    return "0" + number;
  }
  return String(number);
}
function formatTime(seconds) {
  return "00:" + twoDigits(Math.max(0, seconds));
}
function gameScreen() {
  let game = state.game;
  if (game === null) {
    return modesScreen();
  }
  let modeLabel = "PRACTICE";
  let timeLabel = "RELAX";
  if (game.mode === "timed") {
    modeLabel = "TIMED DIVE";
    timeLabel = formatTime(game.remaining());
  }
  let disabled = "disabled";
  let skipDisabled = "disabled";
  if (game.status === "playing") {
    disabled = "";
    if (game.skipsLeft > 0) {
      skipDisabled = "";
    }
  }
  let message = "Look closely, then tap.";
  let shakeClass = "";
  if (state.feedback === "wrong") {
    message = "Almost there! Look closely and try again.";
    shakeClass = "shake";
  }
  let streak = "";
  if (game.streak >= 2) {
    streak = "&#10022; " + game.streak + " in a row!";
  }
  let keys = "";
  let colours = ["mint", "peach", "lilac", "pink", "yellow"];
  for (let n = 0; n < 10; n++) {
    keys =
      keys +
      button(String(n), "answer-" + n, colours[Math.floor(n / 2)], disabled);
  }
  let round = Math.min(game.completed + 1, game.total);
  let progress = (game.completed / game.total) * 100;
  return `<div class="game-top"><div><span class="eyebrow">${modeLabel}</span><h1>How many fish?</h1></div>
    <div class="hud">${pill("ROUND", twoDigits(round) + " / " + game.total)}${pill("SCORE", twoDigits(game.score))}${pill("TIME", timeLabel, "timer-pill")}</div></div>
    <div class="round-progress" aria-label="Round progress"><span style="width:${progress}%"></span></div>
    <div class="game-grid"><section class="question-section"><div class="aquarium ${shakeClass}" id="aquarium">${questionPicture(game)}</div>
    <div class="question-caption"><p id="answer-message" role="status">${message}</p><span class="streak">${streak}</span></div>
    <div class="question-actions">${button("&#9906; &nbsp; FOCUS ZOOM", "zoom", "lilac", disabled)}${button("SKIP &middot; " + game.skipsLeft, "skip", "peach", skipDisabled)}${button("&#8545; &nbsp; PAUSE", "pause", "mint", disabled)}</div></section>
    <section class="panel number-console"><span class="eyebrow">YOUR ANSWER</span><div class="keypad">${keys}</div><p class="muted">+1 for a correct answer</p><p class="small muted keyboard-tip">Keyboard: 0-9 to answer<br>P to pause &middot; Esc to close zoom</p></section></div>`;
}

function resultsScreen() {
  let result = state.lastResult;
  if (result === null) {
    return homeScreen();
  }
  let title = "You made a splash!";
  let reward = "+1 pearl earned &#9673;";
  let stars = 1;
  if (result.score === 10) {
    stars = 3;
  } else if (result.score >= 7) {
    stars = 2;
  }
  if (result.incomplete) {
    title = "A little dive, saved.";
    reward = "Incomplete dive &middot; no completion pearl";
    stars = 0;
  }
  let starPictures = "";
  for (let i = 0; i < 3; i++) {
    if (i < stars) {
      starPictures = starPictures + "&#9733;";
    } else {
      starPictures = starPictures + "&#9734;";
    }
  }
  let source = "DIVE COMPLETE";
  return `${heading(title, source)}<section class="panel results-card"><div class="result-stars yellow-text">${starPictures}</div><strong class="result-score">${result.score} / ${result.total}</strong>
    <p>${result.score} correct &middot; ${result.skipped} skipped &middot; ${result.timeouts} timed out</p><p class="mint-text reward">${reward}</p>
    <p class="muted">Best streak: ${result.bestStreak} &middot; Questions completed: ${result.completed}/${result.total}</p>
    <div class="button-row">${button("DIVE AGAIN", "modes")}${button("MY DIVE LOG", "history", "lilac")}</div></section>`;
}
function historyScreen() {
  let entries = user().history;
  let content = "";
  if (entries.length === 0) {
    content = `<div class="empty-state"><span>&#8776;</span><h2>Your first story is waiting.</h2><p>Complete a dive to start your collection of memories.</p>${button("LET'S PLAY", "modes")}</div>`;
  } else {
    let rows = "";
    for (let i = 0; i < entries.length; i++) {
      let result = entries[i];
      let mode = "Practice";
      let status = "Completed";
      if (result.mode === "timed") {
        mode = "Timed dive";
      }
      if (result.incomplete) {
        status = "Incomplete";
      }
      let date = new Date(result.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      rows =
        rows +
        `<tr><td>${mode}</td><td>${date}</td><td><strong>${result.score} / ${result.total}</strong></td><td>${status}</td></tr>`;
    }
    content = `<div class="table-wrap"><table><thead><tr><th>Dive</th><th>Date</th><th>Score</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return `${heading("Your little ocean stories.", "SAVED IN THIS BROWSER")}<section class="panel history-panel">${content}</section>`;
}
function reefScreen() {
  let explorer = user();
  let items = [
    {
      id: "shell",
      name: "Pearl shell",
      icon: "&#128026;",
      description: "Your first little treasure.",
    },
    {
      id: "star",
      name: "Starfish buddy",
      icon: "&#11088;",
      description: "A sunny friend for your reef.",
    },
    {
      id: "jelly",
      name: "Jelly lantern",
      icon: "&#129724;",
      description: "A gentle glow for moonlit dives.",
    },
  ];
  let cards = "";
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    let owned = false;
    for (let j = 0; j < explorer.collection.length; j++) {
      if (explorer.collection[j] === item.id) {
        owned = true;
      }
    }
    let label = "UNLOCK &middot; 3 PEARLS";
    let action = "unlock";
    let colour = "lilac full";
    let disabled = "";
    if (owned) {
      label = "&#10003; OWNED";
      action = "owned";
      colour = "mint full";
      disabled = "disabled";
    } else if (explorer.pearls < 3) {
      disabled = "disabled";
    }
    cards =
      cards +
      `<section class="panel collection-card"><div class="collectible ${item.id}" aria-hidden="true">${item.icon}</div><h2>${item.name}</h2><p>${item.description}</p>${button(label, action, colour, disabled)}</section>`;
  }
  return `${heading("A reef that grows with you.", explorer.pearls + " PEARLS &#9673;")}<div class="collection-grid">${cards}</div><p class="center muted">Finish a dive &rarr; earn a pearl &rarr; grow your reef.</p>`;
}
function dailyScreen() {
  let today = user().daily[storage.dayKey()];
  if (today === undefined) {
    today = { correct: 0, claimed: false };
  }
  let action = button("KEEP EXPLORING", "modes", "peach full");
  if (today.correct >= 5) {
    if (today.claimed) {
      action = button(
        "&#10003; REWARD CLAIMED",
        "claim",
        "mint full",
        "disabled",
      );
    } else {
      action = button("CLAIM YOUR PEARL", "claim", "mint full");
    }
  }
  let progress = Math.min(100, (today.correct / 5) * 100);
  return `${heading("A tiny goal. A happy habit.", "RESETS AT YOUR LOCAL MIDNIGHT")}<section class="panel goal-panel"><div class="goal-star">&#11088;</div><div><span class="eyebrow peach-text">TODAY'S GOAL</span><strong class="big-number">${Math.min(today.correct, 5)} / 5</strong><h2>Correct answers today</h2><div class="goal-progress"><span style="width:${progress}%"></span></div><p class="mint-text">Reward: +1 pearl &#9673;</p>${action}</div></section>`;
}
function settingsScreen() {
  let settings = user().settings;
  let soundClass = "";
  let motionClass = "";
  if (settings.sound) {
    soundClass = "on";
  }
  if (settings.reducedMotion) {
    motionClass = "on";
  }
  return `${heading("A comfy ocean for everyone.")}<section class="panel settings-panel">
    <div class="setting-row"><div><h2>Little ocean sounds</h2><p>Gentle tones for answer feedback.</p></div><button class="toggle ${soundClass}" role="switch" aria-checked="${settings.sound}" aria-label="Ocean sounds" data-action="toggle-sound"><span></span></button></div>
    <div class="setting-row"><div><h2>Reduced motion</h2><p>A still reef, with the same happy game.</p></div><button class="toggle ${motionClass}" role="switch" aria-checked="${settings.reducedMotion}" aria-label="Reduced motion" data-action="toggle-motion"><span></span></button></div>
    <div class="setting-row"><div><h2>How to play</h2><p>Three little steps to your next adventure.</p></div>${button("VIEW GUIDE", "guide", "lilac")}</div>
    <div class="setting-row"><div><h2>Your explorer account</h2><p>${escapeText(user().name)} &middot; shared server account</p></div>${button("SIGN OUT", "logout", "pink")}</div>
</section>`;
}
function guideScreen() {
  return `${heading("Three little steps.")}<section class="panel guide-panel">
    <div class="guide-step"><b>01</b><div><h2>Look closely.</h2><p>Count all the fish in the question image.</p></div></div>
    <div class="guide-step"><b>02</b><div><h2>Tap your number.</h2><p>Choose 0-9. A correct answer earns +1. Wrong? Try the same question again.</p></div></div>
    <div class="guide-step"><b>03</b><div><h2>Finish your dive.</h2><p>Play 10 rounds. You have 2 skips. In Timed mode, each question has 10 seconds.</p></div></div>
    ${button("LET'S GO", "modes")}<p class="small muted">Focus Zoom enlarges the same image. The Timed countdown continues while you zoom. Pause freezes the timer.</p></section>`;
}
function modalContent() {
  let game = state.game;
  if (state.modal === "pause") {
    return `<div class="modal-symbol mint-text">&#8545;</div><h2>A little breathing break.</h2><p>Your question and timer are paused.</p>${button("&#9654; RESUME", "resume", "mint full")}${button("END DIVE", "end", "peach full")}`;
  }
  if (state.modal === "leave") {
    return `<h2>Leave this dive?</h2><p>Your incomplete result will be saved, without a completion pearl.</p>${button("KEEP PLAYING", "resume", "mint full")}${button("END &amp; CONTINUE", "leave-confirm", "peach full")}`;
  }
  if (state.modal === "feedback") {
    let symbol = "+0";
    let colour = "peach-text";
    let title = "Time is up.";
    let description = "No points this round. A new reef awaits.";
    if (state.feedback === "correct") {
      symbol = "&#9733; +1";
      colour = "yellow-text";
      title = "Brilliant counting!";
      description = "Your next little discovery is waiting.";
    } else if (state.feedback === "skipped") {
      title = "Reef skipped.";
    }
    let nextLabel = "NEXT REEF";
    if (game.completed >= game.total) {
      nextLabel = "SEE RESULTS";
    }
    return `<div class="modal-symbol ${colour}">${symbol}</div><h2>${title}</h2><p>${description}</p>${button(nextLabel, "next", "mint full")}<p class="small muted">${game.completed} / ${game.total} rounds complete</p>`;
  }
  if (state.modal === "zoom") {
    // Zoom the same orange fish shown in the counting area.
    let picture = `<div class="zoom-fish">${questionPicture(game)}</div>`;
    return `<div class="zoom-heading"><h2>Focus lens</h2><button class="icon-button" data-action="close-zoom" aria-label="Close zoom">&#10005;</button></div><p class="small muted">Drag or scroll to explore &middot; timer continues in Timed mode</p><div class="zoom-viewport" tabindex="0" aria-label="Zoomed question, scroll to pan">${picture}</div><div class="button-row"><label for="zoom-range">Zoom</label><input id="zoom-range" type="range" min="1" max="3" value="2" step=".25" aria-label="Zoom scale"></div>`;
  }
  return "";
}
function navigationHtml(screen) {
  let current = screen;
  if (["game", "modes", "results", "guide"].includes(screen)) {
    current = "hub";
  }
  let items = [
    ["hub", "Play"],
    ["reef", "My reef"],
    ["history", "Dive log"],
    ["settings", "Settings"],
  ];
  let links = "";
  for (let i = 0; i < items.length; i++) {
    let extra = "";
    let aria = "";
    if (items[i][0] === current) {
      extra = "active";
      aria = 'aria-current="page"';
    }
    links =
      links +
      `<button data-action="${items[i][0]}" class="nav-button ${extra}" ${aria}>${items[i][1]}</button>`;
  }
  return `<aside class="nav-rail"><a class="monogram" href="#" data-action="hub" aria-label="PearlPop home">P.</a><nav aria-label="Main navigation">${links}</nav><button class="nav-button rail-logout" data-action="logout" aria-label="Sign out">Sign out</button></aside>`;
}
function render() {
  let content = "";
  let rail = "";
  let shellClass = "auth-shell";
  let account = '<span class="topbar-tag">MOONLIT LAGOON</span>';
  if (state.user === null) {
    document.body.classList.remove("reduced-motion");
    content = accountScreen();
  } else {
    shellClass = "";
    document.body.classList.toggle(
      "reduced-motion",
      user().settings.reducedMotion,
    );
    rail = navigationHtml(state.screen);
    account = `<div class="account-chip"><span>${escapeText(user().name)}</span><span class="avatar-dot">&#9673;</span></div>`;
    if (state.screen === "modes") {
      content = modesScreen();
    } else if (state.screen === "game") {
      content = gameScreen();
    } else if (state.screen === "results") {
      content = resultsScreen();
    } else if (state.screen === "history") {
      content = historyScreen();
    } else if (state.screen === "reef") {
      content = reefScreen();
    } else if (state.screen === "daily") {
      content = dailyScreen();
    } else if (state.screen === "settings") {
      content = settingsScreen();
    } else if (state.screen === "guide") {
      content = guideScreen();
    } else {
      content = homeScreen();
    }
  }
  let modal = "";
  if (state.modal !== null) {
    let extra = "";
    let label = "Game message";
    if (state.modal === "zoom") {
      extra = "zoom-dialog";
      label = "Focus lens";
    }
    modal = `<dialog id="game-dialog" class="${extra}" aria-label="${label}">${modalContent()}</dialog>`;
  }
  find("#app").innerHTML =
    `${oceanDecor()}<div class="app-shell ${shellClass}">${rail}<main id="main" tabindex="-1"><header class="topbar"><a class="wordmark" href="#" data-action="hub">PEARLPOP<span class="wordmark-dot">&#10022;</span></a>${account}</header>${backButton()}${content}<footer><span>A little counting. An ocean of discovery.</span></footer></main></div>${modal}`;
  if (state.modal !== null) {
    let dialog = find("#game-dialog");
    dialog.showModal();
    dialog.addEventListener("cancel", closeDialog);
    if (state.modal === "zoom") {
      setupZoom();
    }
  }
  updateClock();
}
function closeDialog(event) {
  event.preventDefault();
  if (state.modal === "zoom") {
    closeZoom();
  } else if (state.modal === "pause" || state.modal === "leave") {
    resumeGame();
  }
}

// EVENT HANDLERS AND GAME FLOW
async function handleAccount(event) {
  event.preventDefault();
  if (state.authBusy) {
    return;
  }
  state.authBusy = true;
  let form = event.target;
  let submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  submit.textContent = "One little moment...";
  try {
    let data = new FormData(form);
    let name = data.get("username");
    let password = data.get("password");
    if (state.screen === "signup") {
      await auth.signup(name, password, data.get("confirm"));
    }
    state.user = await auth.login(name, password);
    state.screen = "hub";
    state.formError = "";
    render();
  } catch (error) {
    state.formError = error.message;
    find("#form-error").textContent = error.message;
    submit.disabled = false;
    submit.textContent = "DIVE IN";
    if (state.screen === "signup") {
      submit.textContent = "CREATE ACCOUNT";
    }
  } finally {
    state.authBusy = false;
  }
}
async function startGame(mode) {
  if (activeGame()) {
    return;
  }
  state.game = new GameEngine({ mode: mode, source: state.source });
  state.screen = "game";
  state.modal = null;
  state.feedback = null;
  await loadQuestion();
}
async function loadQuestion() {
  let game = state.game;
  if (game === null || game.status !== "loading") {
    return;
  }
  if (request !== null) {
    request.abort();
  }
  request = new AbortController();
  let signal = request.signal;
  state.loadError = false;
  state.feedback = null;
  render();
  window.scrollTo(0, 0);
  try {
    let question = await fetchQuestion(signal);

    if (state.game !== game || signal.aborted) {
      return;
    }
    game.load(question);
    questionStarted = Date.now();
    reminderShown = false;
    if (document.hidden && state.modal === null) {
      state.modal = "pause";
    }
    if (state.modal === "pause" || state.modal === "leave") {
      game.pause();
    }
    render();
  } catch (error) {
    if (state.game !== game || signal.aborted) {
      return;
    }
    state.loadError = true;
    render();
  }
}
function answer(number) {
  if (state.game === null) {
    return;
  }
  let outcome = state.game.answer(number);
  if (outcome === "wrong") {
    state.feedback = "wrong";
    playFeedback("wrong");
    render();
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(clearWrongMessage, 1800);
  } else if (outcome !== "ignored") {
    showOutcome(outcome);
  }
}
function clearWrongMessage() {
  if (state.feedback === "wrong") {
    state.feedback = null;
    let message = find("#answer-message");
    if (message !== null) {
      message.textContent = "Look closely, then tap.";
    }
  }
}
async function showOutcome(kind) {
  if (kind === "correct") {
    try {
      await storage.serverAction(state.user, "correct");
    } catch (error) {
      toast("Your daily progress could not be saved.");
    }
    playFeedback("correct");
  } else {
    playFeedback("tap");
  }
  state.feedback = kind;
  state.modal = "feedback";
  render();
  if (kind === "timeout") {
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(function () {
      if (state.modal === "feedback" && state.feedback === "timeout")
        nextQuestion();
    }, 1200);
  }
}
async function nextQuestion() {
  clearTimeout(advanceTimer);
  let game = state.game;
  if (game === null || !game.next()) {
    return;
  }
  state.modal = null;
  state.feedback = null;
  if (game.status === "finished") {
    await finishGame(false);
  } else {
    await loadQuestion();
  }
}
async function finishGame(incomplete) {
  if (state.game === null) {
    return;
  }
  if (request !== null) {
    request.abort();
  }
  let result = state.game.result(incomplete);
  try {
    await storage.serverAction(state.user, "result", { result: result });
  } catch (error) {
    toast(
      "Your result could not be saved. Check your connection and try again.",
    );
  }
  state.lastResult = result;
  state.game = null;
  state.modal = null;
  state.feedback = null;
  state.screen = "results";
  render();
  window.scrollTo(0, 0);
}
function resumeGame() {
  state.pendingNav = null;
  state.modal = null;
  if (state.game !== null) {
    state.game.resume();
  }
  render();
}
function closeZoom() {
  state.modal = null;
  render();
}
// AI assistance was used to keep zooming and pointer dragging separate from rules.
function setupZoom() {
  let viewport = find(".zoom-viewport");
  let slider = find("#zoom-range");
  function changeScale() {
    let scale = Number(slider.value);
    let fishBoard = find(".zoom-fish");
    if (fishBoard !== null) {
      fishBoard.style.width = scale * 100 + "%";
      fishBoard.style.minHeight = scale * 260 + "px";
    }
  }
  slider.addEventListener("input", changeScale);
  changeScale();
  let drag = null;
  viewport.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "touch") {
      return;
    }
    drag = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", function (event) {
    if (drag === null) {
      return;
    }
    viewport.scrollLeft = drag.left + drag.x - event.clientX;
    viewport.scrollTop = drag.top + drag.y - event.clientY;
  });
  function stopDragging() {
    drag = null;
  }
  viewport.addEventListener("pointerup", stopDragging);
  viewport.addEventListener("pointercancel", stopDragging);
}
function updateClock() {
  if (state.game === null || state.screen !== "game") {
    return;
  }
  let label = find(".timer-pill strong");
  if (label === null) {
    return;
  }
  let game = state.game;
  let urgent = false;
  if (game.mode === "timed") {
    label.textContent = formatTime(game.remaining());
    urgent = game.remaining() <= 5;
  } else {
    label.textContent = "RELAX";
  }
  find(".timer-pill").classList.toggle("urgent", urgent);
}
function checkTimer() {
  if (state.game === null) {
    return;
  }
  if (
    state.game.status === "playing" &&
    state.modal === null &&
    !reminderShown &&
    Date.now() - questionStarted >= 4000
  ) {
    let message = find("#answer-message");
    if (message !== null)
      message.textContent = "Please choose a number to answer.";
    reminderShown = true;
  }
  let outcome = state.game.tick();
  if (outcome !== null) {
    showOutcome(outcome);
  } else {
    updateClock();
  }
}
// Both settings use the same save operation.
async function toggleSetting(settingName) {
  let current = user().settings;
  let settings = { sound: current.sound, reducedMotion: current.reducedMotion };
  if (settingName === "sound") {
    settings.sound = !settings.sound;
  } else if (settingName === "reducedMotion") {
    settings.reducedMotion = !settings.reducedMotion;
  }
  await storage.serverAction(state.user, "settings", { settings: settings });
  render();
}

async function handleClick(event) {
  let clicked = event.target.closest("[data-action]");
  if (clicked === null || clicked.disabled) {
    return;
  }
  event.preventDefault();
  let action = clicked.dataset.action;
  try {
    if (action.startsWith("answer-")) {
      answer(Number(action.substring(7)));
    } else if (action === "login" || action === "signup") {
      state.screen = action;
      state.formError = "";
      render();
    } else if (action === "start-practice") {
      await startGame("practice");
    } else if (action === "start-timed") {
      await startGame("timed");
    } else if (action === "pause") {
      if (state.game.pause()) {
        state.modal = "pause";
        render();
      }
    } else if (action === "resume") {
      resumeGame();
    } else if (action === "end") {
      await finishGame(true);
    } else if (action === "leave-confirm") {
      let destination = state.pendingNav;
      state.pendingNav = null;
      await finishGame(true);
      if (destination === "logout") {
        await auth.logout();
        state.user = null;
        state.screen = "login";
        render();
      } else if (destination !== null && destination !== "results") {
        navigate(destination);
      }
    } else if (action === "zoom") {
      state.modal = "zoom";
      render();
    } else if (action === "close-zoom") {
      closeZoom();
    } else if (action === "next") {
      await nextQuestion();
    } else if (action === "skip") {
      let outcome = state.game.skip();
      if (outcome !== "ignored") {
        showOutcome(outcome);
      }
    } else if (action === "retry") {
      await loadQuestion();
    } else if (action === "claim") {
      if (await storage.serverAction(state.user, "claim")) {
        toast("A little reward! +1 pearl added.");
      }
      render();
    } else if (action === "unlock") {
      if (await storage.serverAction(state.user, "unlock")) {
        playFeedback("correct");
        toast("Your jelly lantern is unlocked!");
      }
      render();
    } else if (action === "toggle-sound") {
      await toggleSetting("sound");
      playFeedback("tap");
    } else if (action === "toggle-motion") {
      await toggleSetting("reducedMotion");
    } else if (action === "logout") {
      if (activeGame()) {
        state.game.pause();
        state.pendingNav = "logout";
        state.modal = "leave";
        render();
      } else {
        await auth.logout();
        state.user = null;
        state.screen = "login";
        render();
      }
    } else {
      navigate(action);
    }
  } catch (error) {
    toast(error.message);
    clicked.disabled = false;
  }
}
// AI assistance helped route keyboard events without answering through a dialog.
function handleKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  if (
    event.target.matches("input,textarea,select") ||
    state.screen !== "game"
  ) {
    return;
  }
  if (state.modal !== null) {
    if (event.key === "Escape" && state.modal === "zoom") {
      event.preventDefault();
      closeZoom();
    }
    return;
  }
  if (event.key >= "0" && event.key <= "9" && !event.repeat) {
    answer(Number(event.key));
  }
  if (event.key.toLowerCase() === "p" && state.game.pause()) {
    state.modal = "pause";
    render();
  }
}
function handleHiddenTab() {
  if (document.hidden && state.game !== null) {
    if (state.game.pause()) {
      state.modal = "pause";
      render();
    }
  }
}
function handleBeforeUnload(event) {
  if (activeGame()) {
    event.preventDefault();
    event.returnValue = "";
  }
}
function handleSubmit(event) {
  if (event.target.id === "account-form") {
    handleAccount(event);
  }
}
// Listeners are registered once. Rendering does not register them again.
setInterval(checkTimer, 200);
document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
document.addEventListener("keydown", handleKey);
document.addEventListener("visibilitychange", handleHiddenTab);
window.addEventListener("beforeunload", handleBeforeUnload);
try {
  state.user = await auth.restoreSession();
} catch (error) {
  toast(error.message);
}
render();
