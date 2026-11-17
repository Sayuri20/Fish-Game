/*
 * AI assistance was used to simplify this UI controller and its event handlers.
 * Existing PearlPop markup, CSS and artwork are retained from the supplied ZIP.
 * GameGUI.java and LoginGUI.java (Marc Conrad's teaching example) inspired the
 * separation between the interface, game engine, HTTP service and login data.
 */
import * as auth from "./auth.js";
import * as storage from "./storage.js";
import { playTone } from "./audio.js";
import { openRescue, stopRescue, isRescueActive } from "./rescue-view.js";

let state = {
  user: null,
  screen: "hub",
  authBusy: false,
  formError: "",
  rescueStart: "select",
};
let toastTimer = null;

function backButton() {
  if (state.user === null || state.screen === "hub") return "";
  let destination = "hub";
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

// Here I resize the menu to fit the screen.
function fitScreen() {
  const main = document.querySelector("#main");
  if (!main || !main.getBoundingClientRect) return;
  main.style.transform = "none";
  if (document.querySelector(".survival-game")) return;
  if (window.innerWidth >= 1000 && window.innerHeight >= 500) return;
  const top = main.getBoundingClientRect().top;
  let bottom = window.innerHeight - 10;
  const rail = document.querySelector(".nav-rail");
  if (rail && getComputedStyle(rail).display !== "none") {
    const position = rail.getBoundingClientRect();
    if (position.top > window.innerHeight / 2)
      bottom = Math.min(bottom, position.top - 8);
  }
  const height = Math.max(main.scrollHeight, main.offsetHeight);
  const scale = Math.min(1, Math.max(0.1, (bottom - top) / height));
  main.style.transform = "scale(" + scale + ")";
}
function find(selector) {
  return document.querySelector(selector);
}
function user() {
  return storage.getUser(state.user);
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
  if (!["hub", "history", "settings", "guide"].includes(screen)) return;
  state.screen = screen;
  state.formError = "";
  render();
  window.scrollTo(0, 0);
  if (screen === "history") loadLeaderboard();
}

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
    <section class="auth-intro"><span class="eyebrow">REEF RESCUE</span>
      <h1>Your ocean<br>awaits.</h1><p>Ready, captain?</p>
      <span class="rescue-art art-hamster auth-captain" role="img" aria-label="Hamster submarine captain"></span>
      </section>
    <section class="panel auth-card"><div class="pearl-mark">&#9673;</div><h2>${title}</h2><p class="muted">${description}</p>
      <form id="account-form"><label for="username">Explorer name</label>
        <input id="username" name="username" autocomplete="username" minlength="3" maxlength="20" required placeholder="Your explorer name">
        <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${passwordType}" minlength="6" required placeholder="At least 6 characters">
        ${confirmField}<p id="form-error" class="form-error" role="alert">${escapeText(state.formError)}</p>
        <button class="pearl-button mint full" type="submit">${submitText}</button></form>
      ${otherButton}</section></div>`;
}
function homeScreen() {
  return `${heading("A new world below.", "REEF RESCUE")}
    <section class="rescue-home"><div class="rescue-home-copy"><h2>Swim. Defend.<br>Rescue the reef.</h2><p>Three lives. One venomous enemy.</p>
    <div class="button-row">${button("LET’S DIVE →", "expedition", "mint")}</div>
    <p class="home-pearls">${user().pearls} ◉ pearls</p></div><div class="rescue-hero-art"><span class="rescue-art art-hamster" role="img" aria-label="Hamster captain in mint submarine"></span><span class="venom-art venom-jellyboss" role="img" aria-label="Poison jellyfish enemy"></span></div>
    <div class="rescue-home-floor"><span class="rescue-art art-coral"></span><span class="rescue-art art-plant"></span><span class="rescue-art art-shell"></span></div></section>`;
}
let ranking = null;
let logPanel = "recent";
let rankingError = "";
let rankingLoading = false;
let rankingRequest = 0;
async function loadLeaderboard() {
  const requestId = ++rankingRequest;
  const accountId = state.user;
  rankingLoading = true;
  rankingError = "";
  if (state.screen === "history") render();
  try {
    const response = await fetch("/api/auth/leaderboard", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not load rankings.");
    if (requestId !== rankingRequest || accountId !== state.user) return;
    ranking = result;
  } catch (error) {
    if (requestId !== rankingRequest || accountId !== state.user) return;
    rankingError = error.message;
  }
  if (requestId !== rankingRequest || accountId !== state.user) return;
  rankingLoading = false;
  if (state.screen === "history") render();
}
function historyScreen() {
  const rescue = user().rescue || {};
  const runs = rescue.runs || [];
  let best = rescue.bestScore || 0;
  let wins = 0;
  let rows = "";
  for (const run of runs) {
    best = Math.max(best, run.score);
    if (run.completed) wins++;
  }
  const recentRuns = runs.slice(0, 5);
  for (const run of recentRuns) {
    const date = new Date(run.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    rows += `<tr><td><span class="dive-badge ${run.completed ? "won" : ""}">${run.completed ? "★" : "↓"}</span><span>${run.completed ? "Abyss conquered" : "Depth " + (run.level + 1)}<small>${date} · ${run.lives} hearts left</small></span></td><td class="dive-score">${run.score}<small>points</small></td></tr>`;
  }
  let leaders = "";
  if (rankingLoading)
    leaders =
      '<p class="ranking-message" role="status">Finding our ocean champions…</p>';
  else if (rankingError)
    leaders = `<p class="ranking-message" role="status">${escapeText(rankingError)}</p>`;
  else if (ranking && ranking.leaders.length) {
    for (const entry of ranking.leaders) {
      leaders += `<li class="rank-row ${entry.isYou ? "rank-you" : ""}"><span class="rank-medal medal-${entry.rank}">${entry.rank <= 3 ? ["", "♛", "✦", "✧"][entry.rank] : entry.rank}</span><span class="rank-name">${escapeText(entry.name)}${entry.isYou ? "<small>YOU</small>" : ""}</span><strong>${entry.score}<small>pts</small></strong></li>`;
    }
    leaders = `<ol class="rank-list">${leaders}</ol>`;
  } else
    leaders =
      '<p class="ranking-message">Be the first captain to complete a dive.</p>';
  const rank = ranking && ranking.rank ? "#" + ranking.rank : "—";
  return `${heading("Every dive tells a story.", "YOUR OCEAN RECORDS")}
    <div class="dive-stats"><article><span>✦ PERSONAL BEST</span><strong>${best}<small>pts</small></strong></article><article><span>★ VICTORIES</span><strong>${wins}<small>in recent dives</small></strong></article><article><span>♛ YOUR RANK</span><strong>${rank}<small>among captains</small></strong></article></div>
    <div class="history-tabs" aria-label="Dive record views">${button("Recent dives", "log-recent", logPanel === "recent" ? "mint" : "lilac")}${button("Leaderboard", "log-leaderboard", logPanel === "leaderboard" ? "mint" : "lilac")}</div><div class="dive-dashboard show-${logPanel}"><section class="dive-journal"><header><div><span class="eyebrow">YOUR JOURNEY</span><h2>Recent dives</h2></div><span class="dive-count">${recentRuns.length} recent</span></header>${rows ? `<div class="table-wrap"><table class="dive-table"><thead><tr><th>Adventure</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state"><h3>Your story starts below.</h3>${button("LET’S DIVE", "expedition")}</div>`}</section>
    <section class="ocean-ranking" aria-label="Captain leaderboard"><header><span class="trophy-orb" aria-hidden="true">♛</span><span class="eyebrow">THE TOP 10</span><h2>Ocean champions</h2><p>One captain. One personal best.</p></header>${leaders}<div class="ranking-footer"><span>Best saved scores · ${ranking ? ranking.total : "—"} captains</span>${button("↻ Refresh", "refresh-ranking", "lilac")}</div></section></div>`;
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
  return `${heading("Your ocean adventure.")}<section class="panel guide-panel">
    <div class="guide-step"><b>01</b><div><h2>Swim and defend.</h2><p>Use arrows or WASD to move. Hold SHOOT or Space to fire bubbles at the jellyfish.</p></div></div>
    <div class="guide-step"><b>02</b><div><h2>Collect and protect.</h2><p>Treasures give pearls and shots. Two plastic items restore a heart. Collect floating shields and count the fish for ten seconds of protection. Avoid spiny fish.</p></div></div>
    <div class="guide-step"><b>03</b><div><h2>Dive deeper.</h2><p>Defeat the jellyfish or survive thirty seconds with a heart left. Complete all five depths.</p></div></div>
    ${button("LET’S DIVE", "expedition")}</section>`;
}
function navigationHtml(screen) {
  let current = screen;
  if (["rescue", "guide"].includes(screen)) {
    current = "hub";
  }
  let items = [
    ["hub", "Play"],
    ["living-reef", "Workshop"],
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
  document.body.classList.toggle("rescue-layout", state.screen === "rescue");
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
    if (state.screen === "rescue") {
      content =
        '<section id="rescue-root" aria-label="Reef Rescue expedition"></section>';
    } else if (state.screen === "history") {
      content = historyScreen();
    } else if (state.screen === "settings") {
      content = settingsScreen();
    } else if (state.screen === "guide") {
      content = guideScreen();
    } else {
      content = homeScreen();
    }
  }
  find("#app").innerHTML =
    `${oceanDecor()}<div class="app-shell ${shellClass}">${rail}<main id="main" tabindex="-1"><header class="topbar"><a class="wordmark" href="#" data-action="hub">PEARLPOP<span class="wordmark-dot">&#10022;</span></a>${account}</header>${backButton()}${content}<footer><span>A little counting. An ocean of discovery.</span></footer></main></div>`;
  if (state.screen === "rescue") {
    openRescue(
      find("#rescue-root"),
      state.user,
      function () {
        state.screen = "hub";
        render();
      },
      state.rescueStart,
      fitScreen,
    );
  }
  fitScreen();
}
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
  if (clicked === null || clicked.disabled) return;
  event.preventDefault();
  let action = clicked.dataset.action;
  if (state.screen === "rescue" && !stopRescue(true)) return;
  try {
    if (action === "log-recent" || action === "log-leaderboard") {
      logPanel = action === "log-recent" ? "recent" : "leaderboard";
      render();
    } else if (action === "refresh-ranking") {
      await loadLeaderboard();
    } else if (action === "expedition" || action === "living-reef") {
      state.rescueStart = action === "living-reef" ? "reef" : "select";
      state.screen = "rescue";
      render();
    } else if (action === "login" || action === "signup") {
      state.screen = action;
      state.formError = "";
      render();
    } else if (action === "toggle-sound") {
      await toggleSetting("sound");
      playFeedback("tap");
    } else if (action === "toggle-motion") {
      await toggleSetting("reducedMotion");
    } else if (action === "logout") {
      rankingRequest++;
      ranking = null;
      await auth.logout();
      state.user = null;
      state.screen = "login";
      render();
    } else navigate(action);
  } catch (error) {
    toast(error.message);
    clicked.disabled = false;
  }
}
function handleBeforeUnload(event) {
  if (isRescueActive()) {
    event.preventDefault();
    event.returnValue = "";
  }
}
function handleSubmit(event) {
  if (event.target.id === "account-form") {
    handleAccount(event);
  }
}
// I add these events once when the page starts.
document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);

window.addEventListener("beforeunload", handleBeforeUnload);
window.addEventListener("resize", fitScreen);
window.addEventListener("load", fitScreen);
if (document.fonts) document.fonts.ready.then(fitScreen);
try {
  state.user = await auth.restoreSession();
} catch (error) {
  toast(error.message);
}
render();
