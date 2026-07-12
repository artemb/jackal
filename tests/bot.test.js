import { describe, it, expect } from "vitest";
import {
  createGame,
  key,
  legalMoves,
  movePirate,
  moveShip,
  chooseArrowMove,
  pickUpCoin,
  dropCoin,
  revivePirate,
} from "../src/state.js";
import { chooseBotAction, chooseBotChoice } from "../src/bot.js";

const QUIET = { noise: 0 };

function blankGame() {
  const s = createGame();
  for (const tile of s.tiles.values()) {
    tile.type = "empty";
    tile.coins = 0;
    delete tile.dirs;
    delete tile.arrow;
    delete tile.slow;
    delete tile.steps;
    delete tile.dir;
    delete tile.used;
  }
  return s;
}

function applyPick(s, pick) {
  const pirate =
    pick.action.pirateId != null ? s.pirates[pick.action.pirateId] : null;
  if (pick.pre === "pickup") pickUpCoin(s, pirate);
  if (pick.pre === "drop") dropCoin(s, pirate);
  if (pick.action.kind === "move") movePirate(s, pirate, pick.action.r, pick.action.c);
  else if (pick.action.kind === "ship") moveShip(s, s.players[s.current], pick.action.r, pick.action.c);
  else if (pick.action.kind === "revive") revivePirate(s, pirate);
}

describe("Bot", () => {
  it("produces a legal action from the opening position", () => {
    const s = createGame();
    const pick = chooseBotAction(s, 0, QUIET);
    expect(pick).not.toBe(null);
    if (pick.action.kind === "move") {
      const pirate = s.pirates[pick.action.pirateId];
      expect(pirate.player).toBe(0);
      expect(
        legalMoves(s, pirate).some(
          (m) => m.r === pick.action.r && m.c === pick.action.c,
        ),
      ).toBe(true);
    }
  });

  it("banks a carried coin when the ship is one step away", () => {
    const s = blankGame();
    const p = s.pirates[0];
    p.pos = { r: 11, c: 6 };
    s.tiles.get(key(11, 6)).open = true;
    p.carrying = true;
    const pick = chooseBotAction(s, 0, QUIET);
    expect(pick.action).toMatchObject({ kind: "move", r: 12, c: 6 });
  });

  it("walks toward a visible coin stash", () => {
    const s = blankGame();
    const p = s.pirates[0];
    p.pos = { r: 6, c: 6 };
    s.tiles.get(key(6, 6)).open = true;
    const stash = s.tiles.get(key(6, 7));
    stash.open = true;
    stash.coins = 5;
    // keep the other crews' pirates out of the picture
    for (const q of s.pirates) if (q.player !== 0) q.alive = false;
    const pick = chooseBotAction(s, 0, QUIET);
    expect(pick.action).toMatchObject({ kind: "move", r: 6, c: 7 });
  });

  it("never walks into a revealed cannibal", () => {
    const s = blankGame();
    const p = s.pirates[0];
    p.pos = { r: 6, c: 6 };
    s.tiles.get(key(6, 6)).open = true;
    const lair = s.tiles.get(key(6, 7));
    lair.type = "cannibal";
    lair.open = true;
    for (let run = 0; run < 5; run++) {
      const pick = chooseBotAction(s, 0, QUIET);
      expect(`${pick.action.r},${pick.action.c}`).not.toBe("6,7");
    }
  });

  it("picks up a coin it is standing on before heading home", () => {
    const s = blankGame();
    const p = s.pirates[0];
    p.pos = { r: 6, c: 6 };
    const here = s.tiles.get(key(6, 6));
    here.open = true;
    here.coins = 3;
    s.tiles.get(key(7, 6)).open = true; // a discovered step toward home
    const pick = chooseBotAction(s, 0, QUIET);
    expect(pick.pre).toBe("pickup");
  });

  it("plays a full four-bot game segment without breaking the rules engine", () => {
    const s = createGame({ teams: [0, 1, 2, 3] });
    let acted = 0;
    for (let turn = 0; turn < 40 && s.winner === null; turn++) {
      if (s.pending) {
        chooseArrowMove(s, chooseBotChoice(s, s.current, QUIET));
        continue;
      }
      const pick = chooseBotAction(s, s.current);
      if (!pick) break;
      applyPick(s, pick);
      acted++;
    }
    expect(acted).toBeGreaterThan(20);
    const opened = [...s.tiles.values()].filter((t) => t.open).length;
    expect(opened).toBeGreaterThan(5); // the bots actually explore
  });
});
