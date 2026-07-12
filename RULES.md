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

## Q. Crews and teams

- **Q1.** There are always four crews with a ship each: Red (bottom),
  Blue (top), Green (left) and Yellow (right), each starting at the
  middle of its side with three pirates aboard.
- **Q2.** Each crew belongs to a team. Crews on the same team are allies:
  they never fight each other, share cells and fortresses, may board each
  other's ships (all "own ship" rules mean any friendly ship), free each
  other from traps, and revive each other's dead. With two players each
  controls two crews on opposite sides; with three, one player controls
  two opposite crews; with four, one crew each.
- **Q3.** Crews take turns clockwise around the island: Red (south),
  Green (west), Blue (north), Yellow (east). A crew with no possible
  turn-spending action is skipped.

## S. Ships

- **S1.** Four ships, one per side of the island (Q1).
- **S2.** A ship may move one cell sideways along its own shore, only to
  positions 2–10 along that side (so it always faces an island tile).
- **S3.** A ship may only move if at least one friendly pirate is aboard.
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
- **M6.** Any number of a player's own pirates may share a cell. Enemy
  pirates never share one: arriving triggers a fight (section F).
- **M7.** Moving a pirate spends the player's turn.

## C. Coins

- **C1.** Each map hides exactly 13 coin stashes on random island tiles:
  5 tiles with 1 coin, 2 tiles with 2 coins, 3 tiles with 3 coins,
  2 tiles with 4 coins and 1 tile with 5 coins (31 coins total).
- **C2.** Coins on a tile are hidden until the tile is discovered, then
  shown as a counter on the tile.
- **C3.** A pirate that ends its move on a tile with coins automatically
  picks one up (if it is not already carrying). A pirate standing on
  coins without carrying (e.g. after dropping) may also pick one up
  manually as a free action (does not spend the turn).
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
  a forced chain) flips the tile, then is chased back to the cell it
  came from — one chain step back. A carried coin stays with the pirate,
  and a slow tile's finished crossing is restored. The cell does not
  re-trigger: a single-direction arrow or ice does not fire again (the
  pirate simply rests there) — except as per K3. The turn is spent once
  the pirate settles.
- **K3.** If the cell the pirate is chased back to is a choice tile
  (horse or multi-direction arrow), the choice opens again with the
  crocodile's cell excluded, and the pirate continues from there within
  the same turn.

## F. Fighting

- **F1.** A pirate that moves onto a cell holding enemy pirates (one or
  several) sends them all back aboard their own ship. The attacker takes
  the cell.
- **F2.** A beaten pirate drops a carried coin on the tile where it stood
  and loses crossing progress and any rum hangover. It is not dead.
- **F3.** Fights happen wherever pirates meet, island or sea. The attacker
  then experiences the tile normally (crossing, rum, etc.). The enemy
  ship itself is not conquerable: boarding it is still fatal (O4).

## R. Rum

- **R1.** Every map has 4 rum tiles.
- **R2.** A pirate that lands on a rum tile (by any means, including
  arrows) is knocked out: it cannot move during its player's next turn.
  The player may still move other pirates or the ship.
- **R3.** After sitting out that one turn the pirate moves normally again.

## I. Ice

- **I1.** Every map has 6 ice tiles.
- **I2.** A pirate that enters an ice tile slides one more cell in the
  direction it entered, as a forced move within the same turn. The slide
  behaves like an arrow move: it flips face-down tiles, chains across
  further ice/arrows/crocodiles/rum, can throw the pirate overboard
  (sea), kill it (enemy ship) or board its own ship, and ignores the
  carrying restriction C6.

## N. Traps

- **N1.** Every map has 3 trap tiles.
- **N2.** A pirate that lands alone on a trap is caught: it cannot move at
  all. An ally stepping onto the same trap tile frees it, and neither is
  caught — a pirate is only ever caught when no ally stands on the tile.
- **N3.** Fights still happen on traps: an attacker sends a trapped enemy
  home (freeing it in the process, F2) and is then caught itself if it
  ends up alone. Free actions (C3, C7) remain available while trapped.

## P. Parachute

- **P1.** Every map has 2 parachute tiles.
- **P2.** A pirate that lands on a parachute (by any means) is flown
  straight back aboard its own ship; a carried coin is stashed as gold
  (C8). The tile is revealed and the turn is spent.

## H. Horse

- **H1.** Every map has 2 horse tiles.
- **H2.** A pirate that lands on a horse immediately jumps like a chess
  knight (two cells one way, one cell orthogonally), as a forced move
  within the same turn. Every on-board landing cell is offered (island,
  sea = overboard, own ship = boards, enemy ship = fatal); the player
  chooses. Jumps chain like arrows, and re-entering a horse or arrow tile
  already visited this turn kills the pirate (A5).
- **H3.** A knight jump onto ice slides one further cell in the jump's
  direction, normalized to a single (diagonal) step (I2).

## L. Cannibal

- **L1.** Every map has exactly 1 cannibal tile.
- **L2.** Any pirate that ends up on the cannibal tile — by a chosen move
  or any forced one — dies (O6). A carried coin is lost. The tile stays
  revealed.

## G. Fortresses

- **G1.** Every map has 3 fortress tiles; one of them is the native
  woman's fortress.
- **G2.** Pirates inside a fortress cannot be attacked: enemies cannot
  enter an occupied fortress at all (it is not a legal destination).
  Allies may share it. An empty fortress — coins on it or not — is open
  to anyone.
- **G3.** Forced arrivals (arrows, ice, jumps, cannons) at an
  enemy-occupied fortress are repelled: the intruder retreats to its own
  ship (dropping a carried coin where it last stood) and the turn is
  spent.
- **G4.** A pirate standing in the native woman's fortress may spend the
  turn to revive one of its player's dead pirates. The revived pirate
  appears in that same fortress.

## W. Cannons

- **W1.** Every map has 2 cannon tiles, each facing one straight
  direction fixed randomly when the map is generated.
- **W2.** A pirate that lands on a cannon is fired in that direction: it
  flies in a straight line over the island (without flipping tiles) and
  arrives at the first non-island cell — the sea (overboard, O1), its own
  ship (boards, stashing a coin) or the enemy ship (fatal, O4).

## J. Aeroplane

- **J1.** Every map has exactly 1 aeroplane tile.
- **J2.** A pirate standing on the plane may make its next move from that
  tile to anywhere on the board: island tiles (under the usual entry
  rules, including C6 while carrying and G2 fortress protection), any sea
  cell (going overboard on purpose), its own ship or the enemy ship
  (fatal, O4). The landing has all its normal consequences.
- **J3.** The plane is one-use: a flight beyond walking range spends it
  for the rest of the game. A plain adjacent step off the tile does not.

## V. Victory

- **V1.** Each map holds 31 coins in total (C1). A team's score is the
  gold banked across all its crews' ships.
- **V2.** A team wins the moment its score exceeds what any rival team
  could still reach — the rival's current score plus every coin not yet
  banked and not destroyed. With two teams that means more than half of
  the coins still in play.
- **V3.** Coins destroyed forever (sunk with a swimmer or a dead pirate,
  eaten with its carrier) are out of play and count for nobody.
- **V4.** After the win nothing moves; the game is over.

## T. Turns

- **T1.** Red moves first.
- **T2.** Crews take turns in order (Q3); exactly one turn-spending action
  (move a pirate, move the ship, or revive) per turn.
- **T3.** Free actions (pick up, drop) may be taken any number of times
  during the owner's turn and do not end it.
