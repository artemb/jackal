# Jackal — Rules

The authoritative rule set for this implementation. Rules are numbered so
tests can reference them (e.g. `M3`). When behaviour and this document
disagree, one of them is a bug — decide which and fix it.

## B. Board

- **B1.** The board is a 13×13 grid of cells.
- **B2.** The island is the inner 11×11 area minus its four corner cells:
  117 tiles. Every other cell is sea.
- **B3.** Every island tile starts face down (undiscovered).
- **B4.** A face-down tile is flipped open (discovered) the first time a
  pirate moves onto it. Tiles never flip back.

## S. Ships

- **S1.** There are two ships on opposite sides of the island: Red on the
  bottom sea row, Blue on the top sea row, both starting at the middle
  column (column 6).
- **S2.** A ship may move one cell sideways along its own sea row, only to
  columns 2–10 (so it always faces an island tile).
- **S3.** A ship may only move if at least one of its own pirates is aboard.
- **S4.** When a ship moves, every pirate aboard moves with it.
- **S5.** Moving a ship spends the player's turn.
- **S6.** Ships never leave their own sea row.

## M. Pirate movement

- **M1.** Each player has three pirates, which start aboard their ship.
- **M2.** A pirate aboard a ship may move only to the island tile directly
  in front of the ship.
- **M3.** A pirate on the island moves one step in any of the 8 directions
  (orthogonal or diagonal).
- **M4.** Legal destinations on the island are island tiles; the pirate may
  also step onto its own ship if the ship is on an adjacent cell.
- **M5.** A pirate may never move onto sea cells (other than its own ship)
  or onto the enemy ship.
- **M6.** Any number of pirates may share a cell (no combat yet).
- **M7.** Moving a pirate spends the player's turn.

## C. Coins

- **C1.** Each map hides exactly 13 coin stashes on random island tiles:
  5 tiles with 1 coin, 2 tiles with 2 coins, 3 tiles with 3 coins,
  2 tiles with 4 coins and 1 tile with 5 coins (31 coins total).
- **C2.** Coins on a tile are hidden until the tile is discovered, then
  shown as a counter on the tile.
- **C3.** A pirate standing on a discovered tile with at least one coin may
  pick up exactly one coin. Picking up is a free action (does not spend
  the turn).
- **C4.** A pirate carries at most one coin at a time.
- **C5.** A carried coin moves with the pirate on every move.
- **C6.** A pirate carrying a coin may only move to already discovered
  tiles or to its own ship. This also applies when disembarking (M2): if
  the tile in front of the ship is face down, a carrying pirate cannot
  leave the ship.
- **C7.** A carrying pirate may drop its coin on the tile it stands on.
  Dropping is a free action; the coin is then on that tile and can be
  picked up again (by anyone).
- **C8.** When a pirate carrying a coin moves onto its own ship, the coin
  is stashed automatically and counts toward that player's gold. Stashed
  gold cannot be taken back out.

## A. Arrows

- **A1.** Every map has 21 arrow tiles, 3 of each type:
  single straight, single diagonal, double straight (opposite directions),
  double diagonal (opposite directions), three-way (one diagonal plus the
  two straight directions opposite it, e.g. S+W+NE), four-way straight
  and four-way diagonal.
- **A2.** Each arrow tile is rotated by a random multiple of 90° fixed
  when the map is generated.
- **A3.** A pirate that lands on an arrow tile must immediately move again
  in one of the arrow's directions, within the same turn. The turn only
  passes once the pirate comes to rest.
- **A4.** If the arrow has a single direction the extra move is automatic;
  with several directions the moving player chooses one.
- **A5.** Arrow moves chain: landing on another arrow forces another move.
  If a chain re-enters an arrow tile already visited this turn (a loop),
  the pirate dies (O6).
- **A6.** An arrow pointing into the sea throws the pirate overboard into
  that cell (O1); a carried coin sinks. An arrow pointing at the enemy
  ship kills the pirate (O4). An arrow pointing at the pirate's own ship
  boards it normally (a carried coin is stashed as per C8).
- **A7.** Forced arrow moves ignore the carrying restriction C6: they may
  flip face-down tiles, and the carried coin travels along.

## O. Overboard and death

- **O1.** A pirate thrown into the sea is overboard, swimming in that
  sea cell. Swimmers never carry coins (the coin sinks, A6).
- **O2.** An overboard pirate moves one step in any of the 8 directions to
  an adjacent sea cell, or climbs aboard its own ship. It can never climb
  onto the island.
- **O3.** Swimming spends the turn like a normal move.
- **O4.** A swimmer that boards the enemy ship dies. An enemy ship that
  sails into a swimmer's cell kills it.
- **O5.** A ship that sails into its own swimmer's cell picks it up: the
  pirate is aboard again.
- **O6.** A dead pirate is removed from the game permanently.

## D. Slow tiles

- **D1.** Every map has 11 slow tiles: 5 jungle (2 turns), 4 desert
  (3 turns), 1 island (4 turns) and 1 mountain (5 turns).
- **D2.** Crossing a slow tile takes as many turns as it has steps.
  Entering the tile counts as the first turn; after that the pirate's only
  legal move is stepping in place on its own tile (spending the turn)
  until it has spent all the steps, then it may move off normally.
- **D3.** Leaving a slow tile resets the pirate's crossing progress;
  re-entering starts the crossing over.
- **D4.** A pirate thrown onto a slow tile by an arrow starts crossing
  there; the landing counts as the first turn and any arrow chain ends.
- **D5.** Free actions (C3, C7) remain available while crossing.

## K. Crocodile

- **K1.** Every map has 4 crocodile tiles.
- **K2.** A pirate that lands on a crocodile (by a normal move or through
  an arrow chain) flips the tile, then is chased back to the cell it
  occupied when the turn began — never left stranded mid-chain on an
  arrow. The return does not re-trigger that cell's effect: a finished
  slow-tile crossing is restored, no arrow re-fires, and a carried coin
  stays with the pirate. The turn is spent.

## T. Turns

- **T1.** Red moves first.
- **T2.** Players alternate turns; exactly one turn-spending action (move a
  pirate or move the ship) per turn.
- **T3.** Free actions (pick up, drop) may be taken any number of times
  during the owner's turn and do not end it.
