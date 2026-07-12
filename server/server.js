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
} from "../src/state.js";

const PORT = process.env.PORT ?? 4174;
const rooms = new Map();

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

// Apply a player's action to the room's game. Returns an error string
// or null on success. The server re-derives legality itself: a client
// can only ever submit what the rules already allow.
function applyAction(room, pid, a) {
  const s = room.game;
  if (!s) return "the game has not started";
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
  if (room.game) send(ws, { t: "game", state: serializeGame(room.game) });
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
    case "seat": {
      if (ws.pid !== room.host) return send(ws, { t: "error", msg: "Only the host assigns seats" });
      if (room.game) return send(ws, { t: "error", msg: "The game already started" });
      const seat = msg.crew;
      if (!(seat >= 0 && seat < 4)) return;
      if (msg.playerId !== null && !room.players.has(msg.playerId)) return;
      room.seats[seat] = msg.playerId;
      broadcastRoom(room);
      return;
    }
    case "start": {
      if (ws.pid !== room.host) return send(ws, { t: "error", msg: "Only the host starts the game" });
      if (room.game) return;
      if (room.seats.some((s) => s === null)) {
        return send(ws, { t: "error", msg: "Assign all four crews first" });
      }
      // Crews controlled by the same player are allies: team = controller.
      const controllers = [...new Set(room.seats)];
      const teams = room.seats.map((pid) => controllers.indexOf(pid));
      room.game = createGame({ teams });
      broadcastRoom(room);
      broadcastGame(room);
      return;
    }
    case "action": {
      const err = applyAction(room, ws.pid, msg.a ?? {});
      if (err) return send(ws, { t: "error", msg: err });
      broadcastGame(room);
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
