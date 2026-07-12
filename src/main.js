import {
  SIZE,
  isIsland,
  key,
  deserializeGame,
  legalMoves,
  legalShipMoves,
  piratesAt,
  canPickUp,
  canRevive,
} from "./state.js";

// ---------------------------------------------------------------- identity
let myId = localStorage.getItem("jackalId");
if (!myId) {
  myId = crypto.randomUUID();
  localStorage.setItem("jackalId", myId);
}

// ------------------------------------------------------------------- state
let ws = null;
let room = null; // latest room snapshot from the server
let game = null; // deserialized game state (authoritative copy)
let selected = null; // locally selected pirate id
let flippedKeys = new Set(); // cells to play the flip animation on
let logEntries = []; // game history from the server

// Pieces (ships, pirates) live in a persistent overlay above the grid
// and are moved by CSS transform, so movement animates instead of
// snapping when a new state arrives.
let cellEls = []; // cellEls[r][c] -> grid cell element
const shipEls = new Map(); // crew id -> element
const pirateEls = new Map(); // pirate id -> element
let urlRoom = new URLSearchParams(location.search).get("room");

// -------------------------------------------------------------------- dom
const $ = (id) => document.getElementById(id);
const boardEl = $("board");
const turnEl = $("turn-indicator");
const scoresEl = $("scores");
const actionsEl = $("actions");
const bannerEl = $("conn-banner");

const DIR_GLYPHS = {
  "-1,0": "↑",
  "-1,1": "↗",
  "0,1": "→",
  "1,1": "↘",
  "1,0": "↓",
  "1,-1": "↙",
  "0,-1": "←",
  "-1,-1": "↖",
};

const CANNON_ROTATIONS = {
  "-1,0": "0deg",
  "0,1": "90deg",
  "1,0": "180deg",
  "0,-1": "270deg",
};

// ---------------------------------------------------------------- network
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    bannerEl.classList.add("hidden");
    // Rejoin after a reconnect so the seat and presence come back.
    if (room) {
      send({ t: "join", room: room.id, clientId: myId, name: myName() });
    }
  };
  ws.onmessage = (ev) => handleMessage(JSON.parse(ev.data));
  ws.onclose = () => {
    if (room) bannerEl.classList.remove("hidden");
    setTimeout(connect, 2000);
  };
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function sendAction(a) {
  send({ t: "action", a });
}

function handleMessage(msg) {
  switch (msg.t) {
    case "joined":
      history.replaceState(null, "", `?room=${msg.room}`);
      break;
    case "room":
      room = msg;
      renderView();
      break;
    case "game": {
      const next = deserializeGame(msg.state);
      // Animate tiles that opened since the last snapshot.
      flippedKeys = new Set();
      if (game) {
        for (const [k, tile] of next.tiles) {
          if (tile.open && !game.tiles.get(k)?.open) flippedKeys.add(k);
        }
      }
      game = next;
      if (game.pending) selected = game.pending.pirateId;
      renderView();
      flippedKeys = new Set();
      break;
    }
    case "log":
      if (msg.reset) logEntries = msg.entries;
      else logEntries.push(...msg.entries);
      if (logEntries.length > 300) logEntries = logEntries.slice(-300);
      renderLog();
      break;
    case "error":
      showHint(msg.msg);
      break;
  }
}

function renderLog() {
  const el = $("game-log");
  el.innerHTML = "";
  for (const entry of logEntries) {
    const row = document.createElement("div");
    row.className = "log-entry";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background =
      entry.crew != null ? `var(--p${entry.crew + 1})` : "#ffd75e";
    row.appendChild(dot);
    const text = document.createElement("span");
    text.textContent = entry.text;
    row.appendChild(text);
    el.appendChild(row);
  }
  el.scrollTop = el.scrollHeight;
}

function myName() {
  return $("name-input").value.trim() || "Pirate";
}

function showHint(text) {
  $("lobby-hint").textContent = text;
  setTimeout(() => {
    if ($("lobby-hint").textContent === text) $("lobby-hint").textContent = "";
  }, 4000);
}

// ------------------------------------------------------------------ views
function show(viewId) {
  for (const v of ["view-home", "view-lobby", "view-game"]) {
    $(v).classList.toggle("hidden", v !== viewId);
  }
}

function renderView() {
  if (!room) {
    show("view-home");
    renderHome();
  } else if (!room.started || !game) {
    show("view-lobby");
    renderLobby();
  } else {
    show("view-game");
    renderGame();
  }
}

// ------------------------------------------------------------------- home
function renderHome() {
  const box = $("join-box");
  if (urlRoom) {
    box.classList.remove("hidden");
    $("join-code").textContent = urlRoom;
  } else {
    box.classList.add("hidden");
  }
  turnEl.textContent = "";
  scoresEl.textContent = "";
}

$("name-input").value = localStorage.getItem("jackalName") ?? "";
$("name-input").addEventListener("change", () => {
  localStorage.setItem("jackalName", myName());
});
$("create-btn").addEventListener("click", () => {
  send({ t: "create", clientId: myId, name: myName() });
});
$("join-btn").addEventListener("click", () => {
  send({ t: "join", room: urlRoom, clientId: myId, name: myName() });
});
$("join-code-btn").addEventListener("click", () => {
  const code = $("code-input").value.trim().toUpperCase();
  if (code) send({ t: "join", room: code, clientId: myId, name: myName() });
});

// ------------------------------------------------------------------ lobby
const CREW_NAMES = ["Red", "Blue", "Green", "Yellow"];
// Where each crew sits around the island, mirroring the board.
const CREW_AREAS = ["south", "north", "west", "east"];

function seatCard(crew, editable) {
  const seatPid = room.seats[crew];
  const card = document.createElement("div");
  card.className = "seat-card";
  card.style.borderColor = `var(--p${crew + 1})`;
  card.style.gridArea = CREW_AREAS[crew];

  const head = document.createElement("header");
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = `var(--p${crew + 1})`;
  head.appendChild(dot);
  head.appendChild(document.createTextNode(` ${CREW_NAMES[crew]}`));
  card.appendChild(head);

  if (editable) {
    const sel = document.createElement("select");
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "— unassigned —";
    sel.appendChild(none);
    const bot = document.createElement("option");
    bot.value = BOT;
    bot.textContent = "🤖 Computer";
    if (seatPid === BOT) bot.selected = true;
    sel.appendChild(bot);
    for (const p of room.players) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (seatPid === p.id) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      send({ t: "seat", crew, playerId: sel.value || null });
    });
    card.appendChild(sel);
  } else {
    const label = document.createElement("span");
    label.textContent = seatHolderName(seatPid);
    card.appendChild(label);
  }
  return card;
}

const BOT = "__bot__";

function seatHolderName(seatPid) {
  if (seatPid === BOT) return "🤖 Computer";
  const holder = room.players.find((p) => p.id === seatPid);
  return holder ? holder.name : "— unassigned —";
}

function renderSeats(container, editable) {
  container.innerHTML = "";
  const center = document.createElement("div");
  center.className = "seat-center";
  center.textContent = "🏝️";
  container.appendChild(center);
  for (let crew = 0; crew < 4; crew++) {
    container.appendChild(seatCard(crew, editable));
  }
}

function renderLobby() {
  turnEl.textContent = "Lobby";
  scoresEl.textContent = `Game ${room.id}`;
  $("share-link").value = `${location.origin}/?room=${room.id}`;
  $("game-code").value = room.id;

  const rename = $("rename-input");
  if (document.activeElement !== rename) {
    rename.value =
      room.players.find((p) => p.id === myId)?.name ?? myName();
  }

  const playersEl = $("lobby-players");
  playersEl.innerHTML = "";
  for (const p of room.players) {
    playersEl.appendChild(playerBadge(p));
  }

  renderSeats($("seats"), room.host === myId);
  $("start-btn").classList.toggle("hidden", room.host !== myId);
}

$("rename-input").addEventListener("change", () => {
  const name = $("rename-input").value.trim();
  if (!name) return;
  localStorage.setItem("jackalName", name);
  send({ t: "rename", name });
});

function playerBadge(p, seats = false) {
  const el = document.createElement("div");
  el.className = "player-badge";
  const dot = document.createElement("span");
  dot.className = `presence ${p.connected ? "on" : "off"}`;
  el.appendChild(dot);
  const name = document.createElement("span");
  name.textContent = p.name + (p.id === room.host ? " (host)" : "");
  if (p.id === myId) name.classList.add("me");
  el.appendChild(name);
  if (seats) {
    room.seats.forEach((pid, crew) => {
      if (pid === p.id) {
        const chip = document.createElement("span");
        chip.className = "dot";
        chip.style.background = `var(--p${crew + 1})`;
        el.appendChild(chip);
      }
    });
  }
  return el;
}

$("copy-btn").addEventListener("click", () => {
  navigator.clipboard?.writeText($("share-link").value);
});
$("start-btn").addEventListener("click", () => send({ t: "start" }));

// ------------------------------------------------------------------- game
function myTurn() {
  return game && room && game.winner === null && room.seats[game.current] === myId;
}

function selectedPirate() {
  return selected == null ? null : game.pirates[selected];
}

function currentShipMoves() {
  const pirate = selectedPirate();
  if (!pirate) return [];
  const crew = game.players[game.current];
  if (pirate.pos.r !== crew.ship.r || pirate.pos.c !== crew.ship.c) return [];
  return legalShipMoves(game, crew);
}

function currentMoves() {
  const pirate = selectedPirate();
  if (!pirate || pirate.player !== game.current) return [];
  return [...legalMoves(game, pirate), ...currentShipMoves()];
}

function onCellClick(r, c) {
  if (!myTurn()) return;

  if (game.pending) {
    if (game.pending.options.some((o) => o.r === r && o.c === c)) {
      sendAction({ kind: "choose", r, c });
    }
    return;
  }

  const pirate = selectedPirate();
  if (pirate && pirate.player === game.current) {
    if (currentShipMoves().some((m) => m.r === r && m.c === c)) {
      sendAction({ kind: "ship", r, c });
      return;
    }
    if (legalMoves(game, pirate).some((m) => m.r === r && m.c === c)) {
      sendAction({ kind: "move", pirateId: pirate.id, r, c });
      return;
    }
  }

  // Select / cycle through the current crew's pirates on this cell;
  // one more click after the last pirate deselects, so a change of
  // mind is always one extra click away.
  const own = piratesAt(game, r, c).filter((p) => p.player === game.current);
  const idx = own.findIndex((p) => p.id === selected);
  if (own.length === 0 || idx === own.length - 1) {
    selected = null;
  } else {
    selected = own[idx + 1].id;
  }
  renderGame();
}

function deselect() {
  if (game && !game.pending && selected != null) {
    selected = null;
    renderGame();
  }
}

window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") deselect();
});
boardEl.addEventListener("contextmenu", (ev) => {
  ev.preventDefault();
  deselect();
});

function shipAt(r, c) {
  return game.players.find((p) => p.ship.r === r && p.ship.c === c) ?? null;
}

// Mouse-over rule hints, one per tile kind.
const TILE_HINTS = {
  empty: "Empty ground.",
  croc: "Crocodile — chases the pirate back to where its turn began.",
  rum: "Rum barrel — the pirate sleeps through its player's next turn.",
  ice: "Ice — the pirate slides one more cell in the direction it entered.",
  trap: "Trap — a lone pirate is stuck here until an ally steps in; that frees both.",
  chute: "Parachute — flies the pirate straight back aboard its ship (a carried coin is stashed).",
  horse: "Horse — the pirate immediately jumps like a chess knight to a cell of its choice.",
  cannibal: "Cannibal — any pirate who steps here dies.",
  fort: "Fortress — pirates inside cannot be attacked, and enemies cannot enter while it is occupied.",
  native:
    "Native woman's fortress — protects like a fortress; a pirate here may spend the turn to revive a dead crewmate.",
  cannon:
    "Cannon — fires the pirate over the island into the water in the direction it faces.",
  arrow:
    "Arrow — the pirate must immediately fly on in one of the indicated directions (your choice if several).",
};

function tileHint(tile) {
  let hint;
  if (!tile.open) {
    hint = "Unexplored tile — move a pirate onto it to flip it.";
  } else if (tile.type === "slow") {
    hint = `${tile.slow[0].toUpperCase()}${tile.slow.slice(1)} — takes ${tile.steps} turns to cross (step in place until done).`;
  } else if (tile.type === "plane") {
    hint = tile.used
      ? "Aeroplane (already used) — now just ordinary ground."
      : "Aeroplane — the next move from this tile may go anywhere on the board (one use).";
  } else {
    hint = TILE_HINTS[tile.type] ?? "";
  }
  if (tile.open && tile.coins > 0) {
    hint += ` ${tile.coins} coin${tile.coins > 1 ? "s" : ""} here — a pirate standing on them can pick one up (free action).`;
  }
  return hint;
}

function renderGame() {
  // Drop a stale selection from an earlier turn.
  const sel = selectedPirate();
  if (sel && (!sel.alive || sel.player !== game.current)) selected = null;

  const moves = game.pending ? game.pending.options : currentMoves();
  const moveClass = game.pending ? "arrow-target" : "move-target";
  boardEl.innerHTML = "";
  cellEls = [];

  for (let r = 0; r < SIZE; r++) {
    cellEls.push([]);
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (isIsland(r, c)) {
        const tile = game.tiles.get(key(r, c));
        cell.classList.add("tile", tile.open ? "open" : "closed");
        if (flippedKeys.has(key(r, c))) cell.classList.add("flipping");
        cell.title = tileHint(tile);

        if (tile.open) renderTileContent(cell, tile);
        if (tile.open && tile.coins > 0) {
          const coinsEl = document.createElement("div");
          coinsEl.className = "coins";
          coinsEl.textContent = tile.coins;
          cell.appendChild(coinsEl);
        }
      } else {
        cell.classList.add("sea");
        cell.title =
          "Open sea — pirates thrown overboard swim here one cell per turn and can climb back aboard their own ship.";
      }

      const ship = shipAt(r, c);
      if (ship) {
        cell.title = `${ship.name}'s ship — pirates disembark straight ahead; sailing needs a pirate aboard. Boarding a friendly ship stashes a carried coin; an enemy ship is fatal.`;
      }

      const here = piratesAt(game, r, c);
      if (
        here.length > 0 &&
        myTurn() &&
        here.some((p) => p.player === game.current)
      ) {
        cell.classList.add("selectable");
      }

      if (moves.some((m) => m.r === r && m.c === c)) {
        cell.classList.add(moveClass);
      }

      cell.addEventListener("click", () => onCellClick(r, c));
      boardEl.appendChild(cell);
      cellEls[r].push(cell);
    }
  }

  renderPieces();

  // The board itself signals whose turn it is.
  boardEl.style.boxShadow =
    game.winner !== null
      ? "0 0 26px 4px #ffd75e"
      : `0 0 22px 3px var(--p${game.current + 1})`;

  renderStatus();
  renderActions();
  renderPresence();
}

// Create a piece element without animating its first placement.
function spawnPiece(className) {
  const el = document.createElement("div");
  el.className = className;
  el.style.transition = "none";
  $("pieces").appendChild(el);
  requestAnimationFrame(() => {
    el.style.transition = "";
  });
  return el;
}

function renderPieces() {
  // Ships (with their banked gold on the sail)
  for (const crew of game.players) {
    let el = shipEls.get(crew.id);
    if (!el) {
      el = spawnPiece(`ship p${crew.id + 1}`);
      el.innerHTML = `<span class="glyph"></span><span class="ship-gold"></span>`;
      shipEls.set(crew.id, el);
    }
    const cell = cellEls[crew.ship.r][crew.ship.c];
    el.style.width = `${cell.offsetWidth}px`;
    el.style.height = `${cell.offsetHeight}px`;
    el.style.transform = `translate(${cell.offsetLeft}px, ${cell.offsetTop}px)`;
    el.classList.toggle(
      "active",
      crew.id === game.current && game.winner === null,
    );
    const goldEl = el.querySelector(".ship-gold");
    goldEl.textContent = crew.gold;
    goldEl.style.display = crew.gold > 0 ? "flex" : "none";
  }

  // Pirates, grouped per cell so stacks fan out side by side
  const byCell = new Map();
  for (const p of game.pirates) {
    if (!p.alive) continue;
    const k = key(p.pos.r, p.pos.c);
    if (!byCell.has(k)) byCell.set(k, []);
    byCell.get(k).push(p);
  }

  for (const p of game.pirates) {
    let el = pirateEls.get(p.id);
    if (!el) {
      el = spawnPiece(`pirate p${p.player + 1}`);
      pirateEls.set(p.id, el);
    }
    if (!p.alive) {
      el.classList.add("dead");
      continue;
    }
    el.classList.remove("dead");

    const mates = byCell.get(key(p.pos.r, p.pos.c));
    const idx = mates.indexOf(p);
    const cell = cellEls[p.pos.r][p.pos.c];
    const w = cell.offsetWidth;
    const size = 18;
    const spacing = Math.min(size + 1, (w - 6) / Math.max(mates.length, 1));
    const x =
      cell.offsetLeft +
      w / 2 -
      ((mates.length - 1) * spacing) / 2 -
      size / 2 +
      idx * spacing;
    const y = cell.offsetTop + cell.offsetHeight - size - 4;
    el.style.transform = `translate(${x}px, ${y}px)`;

    el.classList.toggle("carrying", p.carrying);
    el.classList.toggle("drunk", p.drunk > 0);
    el.classList.toggle("trapped", p.trapped);
    el.classList.toggle("selected", p.id === selected);
    const under = game.tiles.get(key(p.pos.r, p.pos.c));
    if (under?.type === "slow" && p.progress < under.steps) {
      el.classList.add("crossing");
      el.textContent = under.steps - p.progress;
    } else {
      el.classList.remove("crossing");
      el.textContent = "";
    }
  }
}

window.addEventListener("resize", () => {
  if (game && room?.started) renderPieces();
});

function renderTileContent(cell, tile) {
  const add = (cls, asset = cls) => {
    cell.classList.add(cls);
    const el = document.createElement("div");
    el.className = `terrain terrain-${asset}`;
    if (tile.type === "plane" && tile.used) el.classList.add("spent");
    cell.appendChild(el);
    return el;
  };
  if (tile.type === "slow") {
    cell.classList.add(tile.slow);
    add("slow", tile.slow);
    const stepsEl = document.createElement("div");
    stepsEl.className = "steps";
    stepsEl.textContent = tile.steps;
    cell.appendChild(stepsEl);
  } else if (tile.type === "croc") add("croc");
  else if (tile.type === "rum") add("rum");
  else if (tile.type === "ice") add("ice");
  else if (tile.type === "trap") add("trap");
  else if (tile.type === "chute") add("chute");
  else if (tile.type === "horse") add("horse");
  else if (tile.type === "cannibal") add("cannibal");
  else if (tile.type === "fort") add("fort");
  else if (tile.type === "native") add("fort", "native");
  else if (tile.type === "plane") add("plane");
  else if (tile.type === "cannon") {
    const cannon = add("cannon");
    cannon.style.setProperty(
      "--cannon-rotation",
      CANNON_ROTATIONS[tile.dir.join(",")],
    );
  } else if (tile.type === "arrow") {
    cell.classList.add("arrow");
    const el = document.createElement("div");
    el.className = "arrows";
    el.textContent = tile.dirs.map((d) => DIR_GLYPHS[d.join(",")]).join("");
    cell.appendChild(el);
  }
}

function renderStatus() {
  if (game.winner !== null) {
    const crews = game.players.filter((p) => p.team === game.winner);
    const controllers = [
      ...new Set(crews.map((c) => seatHolderName(room.seats[c.id]))),
    ];
    turnEl.innerHTML = "";
    for (const c of crews) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = `var(--p${c.id + 1})`;
      turnEl.appendChild(dot);
    }
    const names = crews.map((c) => c.name).join(" & ");
    const who = controllers.length ? ` (${controllers.join(", ")})` : "";
    turnEl.appendChild(
      document.createTextNode(` 🏴‍☠️ ${names}${who} win the game!`),
    );
    scoresEl.textContent = game.players
      .map((p) => `${p.name} 🪙 ${p.gold}`)
      .join("  ·  ");
    return;
  }

  const crew = game.players[game.current];
  turnEl.innerHTML = "";
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = `var(--p${crew.id + 1})`;
  turnEl.appendChild(dot);
  turnEl.appendChild(
    document.createTextNode(
      `${crew.name}'s turn — ${seatHolderName(room.seats[crew.id])}${
        myTurn() ? " (you)" : ""
      }`,
    ),
  );

  scoresEl.textContent = game.players
    .map((p) => `${p.name} 🪙 ${p.gold}`)
    .join("  ·  ");
}

function renderActions() {
  actionsEl.innerHTML = "";
  if (game.winner !== null) return;
  if (game.pending) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = myTurn()
      ? "Forced move! Choose where the pirate goes."
      : "Waiting for the forced-move choice…";
    actionsEl.appendChild(hint);
    return;
  }
  if (!myTurn()) return;
  const pirate = selectedPirate();
  if (!pirate || pirate.player !== game.current) return;

  const addHint = (text) => {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = text;
    actionsEl.appendChild(hint);
  };
  const addButton = (text, action) => {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.addEventListener("click", () => sendAction(action));
    actionsEl.appendChild(btn);
  };

  if (pirate.drunk > 0) {
    addHint("This pirate is sleeping off the rum this turn.");
    return;
  }
  if (pirate.trapped) {
    addHint("Trapped! An ally must step onto this tile to free the pirate.");
    return;
  }

  const tile = game.tiles.get(key(pirate.pos.r, pirate.pos.c));
  if (tile?.type === "slow" && pirate.progress < tile.steps) {
    const left = tile.steps - pirate.progress;
    addHint(
      `Crossing the ${tile.slow}: ${left} more turn${left > 1 ? "s" : ""} on this tile.`,
    );
  }
  if (canPickUp(game, pirate)) {
    addButton("Pick up coin", { kind: "pickup", pirateId: pirate.id });
  }
  if (pirate.carrying) {
    addButton("Drop coin", { kind: "drop", pirateId: pirate.id });
  }
  if (canRevive(game, pirate)) {
    addButton("Revive a fallen pirate (spends the turn)", {
      kind: "revive",
      pirateId: pirate.id,
    });
  }

  const btn = document.createElement("button");
  btn.textContent = "✕ Deselect";
  btn.addEventListener("click", deselect);
  actionsEl.appendChild(btn);
}

function renderPresence() {
  const el = $("game-players");
  el.innerHTML = "";
  for (const p of room.players) {
    el.appendChild(playerBadge(p, true));
  }
  // The host can hand a crew over mid-game (e.g. someone's device died).
  if (room.host === myId) {
    const h = document.createElement("h2");
    h.textContent = "Reassign crews";
    el.appendChild(h);
    const seats = document.createElement("div");
    seats.id = "sidebar-seats";
    renderSeats(seats, true);
    el.appendChild(seats);
  }
}

// ------------------------------------------------------------------- boot
renderView();
connect();
