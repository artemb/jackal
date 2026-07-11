// Tests are written against the numbered rules in RULES.md.
import { describe, it, expect } from "vitest";
import {
  SIZE,
  isIsland,
  key,
  createGame,
  legalMoves,
  movePirate,
  piratesAt,
  piratesAboard,
  legalShipMoves,
  moveShip,
  canPickUp,
  pickUpCoin,
  dropCoin,
  chooseArrowMove,
  ARROW_TYPES,
} from "../src/state.js";

const has = (moves, r, c) => moves.some((m) => m.r === r && m.c === c);

// A game with no coins and no arrows, so movement tests are deterministic.
function blankGame() {
  const s = createGame();
  for (const tile of s.tiles.values()) {
    tile.type = "empty";
    tile.coins = 0;
    delete tile.dirs;
    delete tile.arrow;
    delete tile.slow;
    delete tile.steps;
  }
  return s;
}

function setSlow(state, r, c, steps, { open = false } = {}) {
  const tile = state.tiles.get(key(r, c));
  tile.type = "slow";
  tile.slow = "jungle";
  tile.steps = steps;
  tile.open = open;
}

function setArrow(state, r, c, dirs, { open = false } = {}) {
  const tile = state.tiles.get(key(r, c));
  tile.type = "arrow";
  tile.dirs = dirs;
  tile.open = open;
}

// Put a pirate somewhere and open the tile under it, as if it walked there.
function placePirate(state, pirate, r, c) {
  pirate.pos = { r, c };
  const tile = state.tiles.get(key(r, c));
  if (tile) tile.open = true;
}

describe("B. Board", () => {
  it("B1: the board is 13x13", () => {
    expect(SIZE).toBe(13);
  });

  it("B2: the island is 11x11 minus corners = 117 tiles, rest is sea", () => {
    const s = blankGame();
    expect(s.tiles.size).toBe(117);
    for (const corner of [[1, 1], [1, 11], [11, 1], [11, 11]]) {
      expect(isIsland(...corner)).toBe(false);
    }
    expect(isIsland(0, 6)).toBe(false); // sea ring
    expect(isIsland(6, 6)).toBe(true);
  });

  it("B3: every tile starts face down", () => {
    const s = blankGame();
    for (const tile of s.tiles.values()) expect(tile.open).toBe(false);
  });

  it("B4: moving onto a face-down tile flips it open, and it stays open", () => {
    const s = blankGame();
    const p = s.pirates[0];
    expect(movePirate(s, p, 11, 6)).toBe(true);
    expect(s.tiles.get(key(11, 6)).open).toBe(true);
    const q = s.pirates[3]; // moving another pirate there flips nothing
    placePirate(s, q, 10, 6);
    expect(movePirate(s, q, 11, 6)).toBe(false);
    expect(s.tiles.get(key(11, 6)).open).toBe(true);
  });
});

describe("S. Ships", () => {
  it("S1: Red starts at (12,6), Blue at (0,6)", () => {
    const s = blankGame();
    expect(s.players[0].ship).toEqual({ r: 12, c: 6 });
    expect(s.players[1].ship).toEqual({ r: 0, c: 6 });
  });

  it("S2/S6: a ship moves one cell sideways on its own row, columns 2-10", () => {
    const s = blankGame();
    let moves = legalShipMoves(s, s.players[0]);
    expect(moves).toHaveLength(2);
    expect(has(moves, 12, 5)).toBe(true);
    expect(has(moves, 12, 7)).toBe(true);

    s.players[0].ship = { r: 12, c: 2 };
    for (const p of s.pirates.slice(0, 3)) p.pos = { r: 12, c: 2 };
    moves = legalShipMoves(s, s.players[0]);
    expect(moves).toEqual([{ r: 12, c: 3 }]);
  });

  it("S3: a ship without pirates aboard cannot move", () => {
    const s = blankGame();
    for (const p of s.pirates.slice(0, 3)) placePirate(s, p, 11, 6);
    expect(legalShipMoves(s, s.players[0])).toEqual([]);
  });

  it("S4: moving the ship carries every pirate aboard", () => {
    const s = blankGame();
    moveShip(s, s.players[0], 12, 5);
    for (const p of s.pirates.slice(0, 3)) {
      expect(p.pos).toEqual({ r: 12, c: 5 });
    }
    expect(piratesAboard(s, s.players[0])).toHaveLength(3);
  });

  it("S5: moving the ship spends the turn", () => {
    const s = blankGame();
    moveShip(s, s.players[0], 12, 5);
    expect(s.current).toBe(1);
  });
});

describe("M. Pirate movement", () => {
  it("M1: each player has three pirates starting aboard their ship", () => {
    const s = blankGame();
    for (const player of s.players) {
      expect(piratesAboard(s, player)).toHaveLength(3);
    }
  });

  it("M2: from the ship a pirate may only disembark straight ahead", () => {
    const s = blankGame();
    expect(legalMoves(s, s.pirates[0])).toEqual([{ r: 11, c: 6 }]);
    expect(legalMoves(s, s.pirates[3])).toEqual([{ r: 1, c: 6 }]);
  });

  it("M3/M4: on the island a pirate moves one step in 8 directions, incl. its own ship", () => {
    const s = blankGame();
    const p = s.pirates[0];
    placePirate(s, p, 6, 6);
    expect(legalMoves(s, p)).toHaveLength(8);

    placePirate(s, p, 11, 6); // in front of own ship
    const moves = legalMoves(s, p);
    expect(has(moves, 12, 6)).toBe(true); // own ship
    expect(moves).toHaveLength(6); // 8 neighbours minus 2 other sea cells
  });

  it("M5: sea and the enemy ship are never legal destinations", () => {
    const s = blankGame();
    const p = s.pirates[0];
    placePirate(s, p, 1, 6); // in front of the enemy (Blue) ship
    const moves = legalMoves(s, p);
    expect(has(moves, 0, 6)).toBe(false); // enemy ship
    expect(has(moves, 0, 5)).toBe(false); // sea
  });

  it("M6: any number of pirates may share a cell", () => {
    const s = blankGame();
    const [a, b] = s.pirates;
    movePirate(s, a, 11, 6);
    s.current = 0;
    movePirate(s, b, 11, 6);
    expect(piratesAt(s, 11, 6)).toHaveLength(2);
  });

  it("M7: moving a pirate spends the turn", () => {
    const s = blankGame();
    movePirate(s, s.pirates[0], 11, 6);
    expect(s.current).toBe(1);
  });
});

describe("C. Coins", () => {
  it("C1: every map hides stashes of 5x1, 2x2, 3x3, 2x4, 1x5 coins", () => {
    for (let run = 0; run < 5; run++) {
      const g = createGame();
      const counts = {};
      for (const tile of g.tiles.values()) {
        if (tile.coins > 0) counts[tile.coins] = (counts[tile.coins] ?? 0) + 1;
      }
      expect(counts).toEqual({ 1: 5, 2: 2, 3: 3, 4: 2, 5: 1 });
    }
  });

  it("C3/C4: a pirate picks up exactly one coin as a free action, max one carried", () => {
    const s = blankGame();
    const p = s.pirates[0];
    placePirate(s, p, 6, 6);
    s.tiles.get(key(6, 6)).coins = 2;

    expect(canPickUp(s, p)).toBe(true);
    pickUpCoin(s, p);
    expect(p.carrying).toBe(true);
    expect(s.tiles.get(key(6, 6)).coins).toBe(1);
    expect(s.current).toBe(0); // free action, turn not spent
    expect(canPickUp(s, p)).toBe(false); // C4: already carrying
  });

  it("C5: the carried coin moves with the pirate", () => {
    const s = blankGame();
    const p = s.pirates[0];
    placePirate(s, p, 6, 6);
    p.carrying = true;
    s.tiles.get(key(6, 5)).open = true;
    movePirate(s, p, 6, 5);
    expect(p.carrying).toBe(true);
  });

  it("C6: a carrying pirate only moves to discovered tiles or its own ship", () => {
    const s = blankGame();
    const p = s.pirates[0];
    placePirate(s, p, 11, 6);
    p.carrying = true;
    let moves = legalMoves(s, p);
    expect(moves).toEqual([{ r: 12, c: 6 }]); // only the own ship is "discovered"

    s.tiles.get(key(10, 6)).open = true;
    moves = legalMoves(s, p);
    expect(has(moves, 10, 6)).toBe(true);
    expect(moves).toHaveLength(2);

    // also when disembarking: face-down tile ahead blocks a carrying pirate
    const s2 = blankGame();
    const q = s2.pirates[1];
    q.carrying = true;
    expect(legalMoves(s2, q)).toEqual([]);
    s2.tiles.get(key(11, 6)).open = true;
    expect(legalMoves(s2, q)).toEqual([{ r: 11, c: 6 }]);
  });

  it("C7: dropping leaves the coin on the tile as a free action, re-pickable", () => {
    const s = blankGame();
    const p = s.pirates[0];
    placePirate(s, p, 6, 6);
    s.tiles.get(key(6, 6)).coins = 0;
    p.carrying = true;

    dropCoin(s, p);
    expect(p.carrying).toBe(false);
    expect(s.tiles.get(key(6, 6)).coins).toBe(1);
    expect(s.current).toBe(0); // free action
    expect(canPickUp(s, p)).toBe(true);
  });

  it("C8: boarding the own ship stashes the coin automatically", () => {
    const s = blankGame();
    const p = s.pirates[0];
    placePirate(s, p, 11, 6);
    p.carrying = true;
    movePirate(s, p, 12, 6);
    expect(p.carrying).toBe(false);
    expect(s.players[0].gold).toBe(1);
    dropCoin(s, p); // stashed gold cannot be taken back out
    expect(s.players[0].gold).toBe(1);
    expect(p.carrying).toBe(false);
  });
});

describe("A. Arrows", () => {
  const N = [-1, 0];
  const S = [1, 0];
  const EAST = [0, 1];

  it("A1: every map has 3 arrow tiles of each of the 7 types", () => {
    const s = createGame();
    const counts = {};
    for (const tile of s.tiles.values()) {
      if (tile.type === "arrow") counts[tile.arrow] = (counts[tile.arrow] ?? 0) + 1;
    }
    const expected = {};
    for (const name of Object.keys(ARROW_TYPES)) expected[name] = 3;
    expect(counts).toEqual(expected);
  });

  it("A2: arrow directions are rotations of the base type", () => {
    const s = createGame();
    for (const tile of s.tiles.values()) {
      if (tile.type !== "arrow") continue;
      expect(tile.dirs).toHaveLength(ARROW_TYPES[tile.arrow].length);
      for (const [dr, dc] of tile.dirs) {
        expect(Math.abs(dr) <= 1 && Math.abs(dc) <= 1).toBe(true);
        expect(dr !== 0 || dc !== 0).toBe(true);
      }
    }
  });

  it("A3/A4: a single-direction arrow moves the pirate on automatically", () => {
    const s = blankGame();
    setArrow(s, 11, 6, [N]);
    const p = s.pirates[0];
    movePirate(s, p, 11, 6);
    expect(p.pos).toEqual({ r: 10, c: 6 });
    expect(s.tiles.get(key(10, 6)).open).toBe(true);
    expect(s.pending).toBe(null);
    expect(s.current).toBe(1); // one turn spent in total
  });

  it("A4: a multi-direction arrow waits for the player to choose", () => {
    const s = blankGame();
    setArrow(s, 11, 6, [N, EAST]);
    const p = s.pirates[0];
    movePirate(s, p, 11, 6);
    expect(s.current).toBe(0); // turn not over yet
    expect(s.pending.pirateId).toBe(p.id);
    expect(s.pending.options).toEqual([
      { r: 10, c: 6 },
      { r: 11, c: 7 },
    ]);

    chooseArrowMove(s, { r: 5, c: 5 }); // not an option: ignored
    expect(s.pending).not.toBe(null);

    chooseArrowMove(s, { r: 11, c: 7 });
    expect(p.pos).toEqual({ r: 11, c: 7 });
    expect(s.pending).toBe(null);
    expect(s.current).toBe(1);
  });

  it("A5: arrows chain, and a loop throws the pirate back to its ship", () => {
    const s = blankGame();
    setArrow(s, 11, 6, [N]);
    setArrow(s, 10, 6, [N]);
    const p = s.pirates[0];
    movePirate(s, p, 11, 6);
    expect(p.pos).toEqual({ r: 9, c: 6 });
    expect(s.current).toBe(1);

    const s2 = blankGame();
    setArrow(s2, 11, 6, [N]);
    setArrow(s2, 10, 6, [S]); // points straight back: a loop
    const q = s2.pirates[0];
    movePirate(s2, q, 11, 6);
    expect(q.pos).toEqual({ r: 12, c: 6 }); // back aboard
    expect(s2.current).toBe(1);
  });

  it("A6: an arrow into the sea or enemy ship returns the pirate to its ship, coin lost", () => {
    const s = blankGame();
    setArrow(s, 11, 5, [S], { open: true }); // points into the sea at (12,5)
    const p = s.pirates[0];
    placePirate(s, p, 10, 5);
    p.carrying = true;
    movePirate(s, p, 11, 5);
    expect(p.pos).toEqual({ r: 12, c: 6 }); // back aboard the own ship
    expect(p.carrying).toBe(false);
    expect(s.players[0].gold).toBe(0); // the coin sank, it was not stashed
    expect(s.current).toBe(1);

    const s2 = blankGame();
    setArrow(s2, 1, 6, [N], { open: true }); // points at the enemy (Blue) ship
    const q = s2.pirates[0];
    placePirate(s2, q, 2, 6);
    movePirate(s2, q, 1, 6);
    expect(q.pos).toEqual({ r: 12, c: 6 });
  });

  it("A6b: an arrow pointing at the own ship boards it normally (coin stashed)", () => {
    const s = blankGame();
    setArrow(s, 11, 6, [S], { open: true });
    const p = s.pirates[0];
    placePirate(s, p, 10, 6);
    p.carrying = true;
    movePirate(s, p, 11, 6);
    expect(p.pos).toEqual({ r: 12, c: 6 });
    expect(s.players[0].gold).toBe(1);
    expect(p.carrying).toBe(false);
  });

  it("A7: a forced arrow move may flip face-down tiles even while carrying", () => {
    const s = blankGame();
    setArrow(s, 6, 6, [N], { open: true });
    const p = s.pirates[0];
    placePirate(s, p, 7, 6);
    p.carrying = true;
    movePirate(s, p, 6, 6);
    expect(p.pos).toEqual({ r: 5, c: 6 });
    expect(s.tiles.get(key(5, 6)).open).toBe(true);
    expect(p.carrying).toBe(true);
  });
});

describe("D. Slow tiles", () => {
  it("D1: every map has 5 jungle(2), 4 desert(3), 1 island(4), 1 mountain(5)", () => {
    const s = createGame();
    const counts = {};
    for (const tile of s.tiles.values()) {
      if (tile.type === "slow") {
        counts[tile.slow] = (counts[tile.slow] ?? 0) + 1;
        const steps = { jungle: 2, desert: 3, island: 4, mountain: 5 };
        expect(tile.steps).toBe(steps[tile.slow]);
      }
    }
    expect(counts).toEqual({ jungle: 5, desert: 4, island: 1, mountain: 1 });
  });

  it("D2: crossing takes as many turns as the tile has steps", () => {
    const s = blankGame();
    setSlow(s, 11, 6, 3); // a 3-turn tile
    const p = s.pirates[0];
    movePirate(s, p, 11, 6); // turn 1: enter
    expect(p.progress).toBe(1);
    expect(s.current).toBe(1);

    s.current = 0;
    expect(legalMoves(s, p)).toEqual([{ r: 11, c: 6 }]); // stuck: step in place
    movePirate(s, p, 11, 6); // turn 2
    expect(p.progress).toBe(2);
    expect(s.current).toBe(1);

    s.current = 0;
    movePirate(s, p, 11, 6); // turn 3: crossing done
    expect(p.progress).toBe(3);
    expect(legalMoves(s, p).length).toBeGreaterThan(1); // free to move on
  });

  it("D3: leaving a slow tile resets progress; re-entering starts over", () => {
    const s = blankGame();
    setSlow(s, 6, 6, 2);
    const p = s.pirates[0];
    placePirate(s, p, 6, 5);
    movePirate(s, p, 6, 6);
    movePirate(s, p, 6, 6); // crossing done
    movePirate(s, p, 6, 5); // leave
    expect(p.progress).toBe(0);
    movePirate(s, p, 6, 6); // re-enter
    expect(p.progress).toBe(1);
    expect(legalMoves(s, p)).toEqual([{ r: 6, c: 6 }]);
  });

  it("D4: an arrow can throw a pirate onto a slow tile; entry counts as turn one", () => {
    const s = blankGame();
    setArrow(s, 11, 6, [[-1, 0]]);
    setSlow(s, 10, 6, 2);
    const p = s.pirates[0];
    movePirate(s, p, 11, 6); // arrow chains onto the jungle
    expect(p.pos).toEqual({ r: 10, c: 6 });
    expect(p.progress).toBe(1);
    expect(s.pending).toBe(null);
    expect(s.current).toBe(1);
    s.current = 0;
    expect(legalMoves(s, p)).toEqual([{ r: 10, c: 6 }]);
  });
});

describe("T. Turns", () => {
  it("T1: Red moves first", () => {
    const s = blankGame();
    expect(s.current).toBe(0);
    expect(s.players[0].name).toBe("Red");
  });

  it("T2: turns alternate on every turn-spending action", () => {
    const s = blankGame();
    movePirate(s, s.pirates[0], 11, 6);
    expect(s.current).toBe(1);
    movePirate(s, s.pirates[3], 1, 6);
    expect(s.current).toBe(0);
    moveShip(s, s.players[0], 12, 5);
    expect(s.current).toBe(1);
  });

  it("T3: pick up and drop are free actions", () => {
    const s = blankGame();
    const p = s.pirates[0];
    placePirate(s, p, 6, 6);
    s.tiles.get(key(6, 6)).coins = 3;
    pickUpCoin(s, p);
    dropCoin(s, p);
    pickUpCoin(s, p);
    expect(s.current).toBe(0);
    expect(p.carrying).toBe(true);
  });
});
