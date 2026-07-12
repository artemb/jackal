# Jackal game assets

The PNG files in `source/` are the generated high-resolution masters. Run
`npm run assets` to reproducibly crop and optimize the WebP files consumed by
the client.

The masters were created with the built-in image generator from the approved
flat, screen-printed art direction. `tiles-a.png` intentionally has its lower
token samples removed by the build script so game pieces have a quiet area.

Directional arrows and pirate pieces remain code-rendered for clarity. The
cannon master points north; the client rotates it to match the tile direction.
