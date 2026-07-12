// Authoritative Jackal game server: rooms, seats, presence and action
// validation over WebSocket. The client renders whatever this broadcasts.
import { createServer } from "node:http";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import {
  createGame,
  serializeGame,
  legalMoves,
  movePirate,
  legalShipMoves,
  moveShip,
  chooseArrowMove,
  canPickUp,
  pickUpCoin,
  dropCoin,
  canRevive,
  revivePirate,
  isIsland,
} from "../src/state.js";
import { chooseBotAction, chooseBotChoice } from "../src/bot.js";

const PORT = process.env.PORT ?? 4174;
const rooms = new Map();

// Seats can be given to the computer. Every bot seat is its own team.
export const BOT = "__bot__";
const BOT_DELAY = 900;

function maybeBotTurn(room) {
  const s = room.game;
  if (!s || s.winner !== null) return;
  if (room.seats[s.current] !== BOT) return;
  if (room.botTimer) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    const g = room.game;
    if (!g || g.winner !== null || room.seats[g.current] !== BOT) return;
    const pre = snapshot(room);
    try {
      if (g.pending) {
        chooseArrowMove(g, chooseBotChoice(g, g.current));
      } else {
        const pick = chooseBotAction(g, g.current);
        if (!pick) return; // nothing possible; endTurn skipping prevents this
        const pirate =
          pick.action.pirateId != null ? g.pirates[pick.action.pirateId] : null;
        if (pick.pre === "pickup") pickUpCoin(g, pirate);
        if (pick.pre === "drop") dropCoin(g, pirate);
        if (pick.action.kind === "move") {
          movePirate(g, pirate, pick.action.r, pick.action.c);
        } else if (pick.action.kind === "ship") {
          moveShip(g, g.players[g.current], pick.action.r, pick.action.c);
        } else if (pick.action.kind === "revive") {
          revivePirate(g, pirate);
        }
      }
    } catch (e) {
      console.error("bot turn failed:", e);
      return;
    }
    logDiff(room, pre);
    broadcastGame(room);
    maybeBotTurn(room); // chains through bot pendings and successive bots
  }, BOT_DELAY);
}

function newRoomId() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function roomSnapshot(room) {
  return {
    t: "room",
    id: room.id,
    host: room.host,
    seats: room.seats,
    started: room.game !== null,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
    })),
  };
}

function broadcast(room, msg) {
  for (const p of room.players.values()) send(p.ws, msg);
}

function broadcastRoom(room) {
  broadcast(room, roomSnapshot(room));
}

function broadcastGame(room) {
  if (room.game) broadcast(room, { t: "game", state: serializeGame(room.game) });
}

const inList = (list, r, c) => list.some((m) => m.r === r && m.c === c);

// ------------------------------------------------------------ game log
// Entries are derived by diffing the serialized state around every
// applied action, so humans and bots produce the same history.

const coord = (pos) => String.fromCharCode(65 + pos.c) + (pos.r + 1);
const samePos = (a, b) => a.r === b.r && a.c === b.c;

const TILE_NAMES = {
  empty: "empty ground",
  croc: "a crocodile",
  rum: "a rum barrel",
  ice: "ice",
  trap: "a trap",
  chute: "a parachute",
  horse: "a horse",
  cannibal: "the cannibal",
  fort: "a fortress",
  native: "the native woman's fortress",
  cannon: "a cannon",
  plane: "the aeroplane",
  arrow: "an arrow",
};

function tileName(tile) {
  if (tile.type === "slow") return `a ${tile.slow} (${tile.steps} turns)`;
  return TILE_NAMES[tile.type] ?? tile.type;
}

function seatName(room, crewId) {
  const pid = room.seats[crewId];
  if (pid === BOT) return "Computer";
  return room.players.get(pid)?.name ?? "?";
}

function describeDiff(pre, post, room) {
  const out = [];
  const crewId = pre.current;
  const actor = `${pre.players[crewId].name} (${seatName(room, crewId)})`;
  const push = (text, c = crewId) => out.push({ crew: c, text });

  const goldDelta = post.players.map((pl, i) => pl.gold - pre.players[i].gold);
  const lostDelta = (post.lostCoins ?? 0) - (pre.lostCoins ?? 0);
  const postTiles = new Map(post.tiles);
  const preTiles = new Map(pre.tiles);

  const preShip = pre.players[crewId].ship;
  const postShip = post.players[crewId].ship;
  const shipMoved = !samePos(preShip, postShip);
  if (shipMoved) push(`${actor} sailed the ship to ${coord(postShip)}`);

  const overboard = (p) =>
    !isIsland(p.pos.r, p.pos.c) &&
    !post.players.some(
      (pl) =>
        pl.team === post.players[p.player].team && samePos(pl.ship, p.pos),
    );

  const postP = new Map(post.pirates.map((p) => [p.id, p]));
  for (const a of pre.pirates) {
    const b = postP.get(a.id);
    const owner = pre.players[a.player];
    const moved = !samePos(a.pos, b.pos);

    if (a.alive && !b.alive) {
      push(`☠️ ${owner.name}'s pirate died`, a.player);
      continue;
    }
    if (!a.alive && b.alive) {
      push(`${actor} revived a pirate at ${coord(b.pos)}`);
      continue;
    }
    if (!a.alive) continue;

    if (moved && a.player === crewId) {
      // pirates riding the ship are covered by the ship line
      if (shipMoved && samePos(a.pos, preShip) && samePos(b.pos, postShip)) {
        continue;
      }
      let text = `${actor} moved a pirate ${coord(a.pos)} → ${coord(b.pos)}`;
      const also = [];
      if (b.drunk > 0 && a.drunk === 0) also.push("passed out on the rum");
      if (b.trapped && !a.trapped) also.push("got caught in the trap");
      if (overboard(b)) also.push("went overboard");
      if (also.length) text += ` and ${also.join(" and ")}`;
      push(text);
    } else if (moved && owner.team !== pre.players[crewId].team) {
      push(`⚔️ ${owner.name}'s pirate was sent back to its ship`, a.player);
    }

    if (!moved && a.player === crewId && b.progress > a.progress) {
      const tile = postTiles.get(`${b.pos.r},${b.pos.c}`);
      if (tile?.type === "slow") {
        const left = tile.steps - b.progress;
        push(
          `${actor} kept crossing the ${tile.slow} at ${coord(b.pos)}` +
            (left > 0 ? ` (${left} turn${left > 1 ? "s" : ""} left)` : " — through!"),
        );
      }
    }

    if (!a.carrying && b.carrying) {
      push(`${actor} picked up a coin at ${coord(b.pos)}`);
    }
    if (
      a.carrying &&
      !b.carrying &&
      a.player === crewId &&
      goldDelta[crewId] === 0 &&
      lostDelta === 0 &&
      samePos(a.pos, b.pos)
    ) {
      push(`${actor} dropped a coin at ${coord(b.pos)}`);
    }
  }

  for (const [k, tile] of postTiles) {
    if (tile.open && !preTiles.get(k).open) {
      const [r, c] = k.split(",").map(Number);
      const coins = tile.coins
        ? ` with ${tile.coins} coin${tile.coins > 1 ? "s" : ""}`
        : "";
      push(`🔍 revealed ${tileName(tile)}${coins} at ${coord({ r, c })}`);
    }
  }

  post.players.forEach((pl, i) => {
    if (goldDelta[i] > 0) {
      push(
        `🪙 ${pl.name} banked ${goldDelta[i] === 1 ? "a coin" : `${goldDelta[i]} coins`} (${pl.gold} total)`,
        i,
      );
    }
  });
  if (lostDelta > 0) push("💧 a coin was lost forever");

  if (post.pending && !pre.pending && room.seats[crewId] !== BOT) {
    push(`${actor} must choose where the pirate flies`);
  }

  if (post.winner !== null && pre.winner === null) {
    const names = post.players
      .filter((p) => p.team === post.winner)
      .map((p) => p.name)
      .join(" & ");
    out.push({ crew: null, text: `🏴‍☠️ ${names} win the game!` });
  }
  return out;
}

function snapshot(room) {
  return JSON.parse(JSON.stringify(serializeGame(room.game)));
}

function logDiff(room, pre) {
  const entries = describeDiff(pre, serializeGame(room.game), room);
  if (entries.length === 0) return;
  room.log.push(...entries);
  if (room.log.length > 300) room.log = room.log.slice(-300);
  broadcast(room, { t: "log", entries });
}

// Apply a player's action to the room's game. Returns an error string
// or null on success. The server re-derives legality itself: a client
// can only ever submit what the rules already allow.
function applyAction(room, pid, a) {
  const s = room.game;
  if (!s) return "the game has not started";
  if (s.winner !== null) return "the game is over";
  if (room.seats[s.current] !== pid) return "not your crew's turn";

  if (a.kind === "choose") {
    if (!s.pending) return "nothing to choose";
    if (!inList(s.pending.options, a.r, a.c)) return "illegal choice";
    chooseArrowMove(s, { r: a.r, c: a.c });
    return null;
  }
  if (s.pending) return "resolve the forced move first";

  if (a.kind === "ship") {
    const crew = s.players[s.current];
    if (!inList(legalShipMoves(s, crew), a.r, a.c)) return "illegal ship move";
    moveShip(s, crew, a.r, a.c);
    return null;
  }

  const pirate = s.pirates[a.pirateId];
  if (!pirate || pirate.player !== s.current || !pirate.alive) {
    return "not a usable pirate of the current crew";
  }
  if (a.kind === "move") {
    if (!inList(legalMoves(s, pirate), a.r, a.c)) return "illegal move";
    movePirate(s, pirate, a.r, a.c);
  } else if (a.kind === "pickup") {
    if (!canPickUp(s, pirate)) return "cannot pick up here";
    pickUpCoin(s, pirate);
  } else if (a.kind === "drop") {
    if (!pirate.carrying) return "nothing to drop";
    dropCoin(s, pirate);
  } else if (a.kind === "revive") {
    if (!canRevive(s, pirate)) return "cannot revive here";
    revivePirate(s, pirate);
  } else {
    return "unknown action";
  }
  return null;
}

function joinRoom(room, ws, msg) {
  let player = room.players.get(msg.clientId);
  if (player) {
    // Reconnect: replace the socket, keep the seat and identity.
    if (player.ws && player.ws !== ws) player.ws.terminate();
    player.ws = ws;
    player.connected = true;
    if (msg.name) player.name = msg.name;
  } else {
    player = {
      id: msg.clientId,
      name: msg.name || "Pirate",
      ws,
      connected: true,
    };
    room.players.set(player.id, player);
  }
  ws.room = room;
  ws.pid = player.id;
  send(ws, { t: "joined", room: room.id, you: player.id });
  broadcastRoom(room);
  if (room.game) {
    send(ws, { t: "game", state: serializeGame(room.game) });
    send(ws, { t: "log", entries: room.log, reset: true });
  }
}

function handleMessage(ws, msg) {
  switch (msg.t) {
    case "create": {
      const room = {
        id: newRoomId(),
        players: new Map(),
        host: msg.clientId,
        seats: [null, null, null, null],
        game: null,
        log: [],
      };
      rooms.set(room.id, room);
      joinRoom(room, ws, msg);
      return;
    }
    case "join": {
      const room = rooms.get((msg.room || "").toUpperCase());
      if (!room) return send(ws, { t: "error", msg: "No such game" });
      joinRoom(room, ws, msg);
      return;
    }
  }

  const room = ws.room;
  if (!room) return send(ws, { t: "error", msg: "Join a game first" });

  switch (msg.t) {
    case "rename": {
      const player = room.players.get(ws.pid);
      const name = String(msg.name ?? "").trim().slice(0, 20);
      if (!player || !name) return;
      player.name = name;
      broadcastRoom(room);
      return;
    }
    case "seat": {
      // Seats may be reassigned even mid-game, so the host can hand a
      // crew to another player if someone's device dies. Alliances are
      // fixed at start; this only changes who drives the crew.
      if (ws.pid !== room.host) return send(ws, { t: "error", msg: "Only the host assigns seats" });
      const seat = msg.crew;
      if (!(seat >= 0 && seat < 4)) return;
      if (
        msg.playerId !== null &&
        msg.playerId !== BOT &&
        !room.players.has(msg.playerId)
      ) {
        return;
      }
      if (room.game && msg.playerId === null) {
        return send(ws, { t: "error", msg: "A started game needs every crew driven" });
      }
      room.seats[seat] = msg.playerId;
      broadcastRoom(room);
      maybeBotTurn(room); // in case a stuck crew was just handed to the bot
      return;
    }
    case "start": {
      if (ws.pid !== room.host) return send(ws, { t: "error", msg: "Only the host starts the game" });
      if (room.game) return;
      if (room.seats.some((s) => s === null)) {
        return send(ws, { t: "error", msg: "Assign all four crews first" });
      }
      // Crews controlled by the same player are allies: team = controller.
      // Every bot seat is its own controller (bots are never allied).
      const controllers = room.seats.map((pid, i) =>
        pid === BOT ? `${BOT}${i}` : pid,
      );
      const uniq = [...new Set(controllers)];
      const teams = controllers.map((c) => uniq.indexOf(c));
      room.game = createGame({ teams });
      room.log = [{ crew: null, text: "⚓ The game begins — Red moves first" }];
      broadcastRoom(room);
      broadcastGame(room);
      broadcast(room, { t: "log", entries: room.log, reset: true });
      maybeBotTurn(room);
      return;
    }
    case "action": {
      const pre = room.game ? snapshot(room) : null;
      const err = applyAction(room, ws.pid, msg.a ?? {});
      if (err) return send(ws, { t: "error", msg: err });
      if (pre) logDiff(room, pre);
      broadcastGame(room);
      maybeBotTurn(room);
      return;
    }
  }
}

// In production the same process serves the built client from dist/
// (in development Vite serves the client and proxies /ws here).
const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const httpServer = createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = resolve(join(DIST, urlPath === "/" ? "index.html" : urlPath));
  try {
    if (!filePath.startsWith(DIST)) throw new Error("outside dist");
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
    });
    res.end(data);
  } catch {
    // Unknown paths get the app shell (join links are ?room=..., so this
    // is just a safety net); no dist at all means dev mode.
    try {
      const data = await readFile(join(DIST, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    } catch {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Jackal game server (no client build present)\n");
    }
  }
});

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      handleMessage(ws, msg);
    } catch (e) {
      console.error("message handling failed:", e);
      send(ws, { t: "error", msg: "Server error" });
    }
  });
  ws.on("close", () => {
    const room = ws.room;
    if (!room) return;
    const player = room.players.get(ws.pid);
    if (player && player.ws === ws) {
      player.connected = false;
      broadcastRoom(room);
    }
  });
});

// Presence heartbeat: sockets that miss a ping round are terminated,
// which flips their player to disconnected for everyone to see.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

httpServer.listen(PORT, () => {
  console.log(`Jackal server listening on :${PORT}`);
});
