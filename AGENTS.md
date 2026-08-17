# ArtMaker contributor guide

## Project

ArtMaker is an Astro 6, Svelte 5, and TypeScript PWA for designing pixel-accurate printed artwork. The primary target is desktop Chromium. Keep the simplified Chinese and English interfaces in sync.

## Commands

- `npm run dev` starts the local development server.
- `npm run check` runs Astro and Svelte type checks.
- `npm test` runs the Vitest suite.
- `npm run build` creates the production PWA build.

Run check, tests, and build before handing off a change.

After every project edit, review and update this `AGENTS.md` in the same change whenever architecture, commands, behavior, constraints, or contributor expectations have changed. Treat keeping this file synchronized with the actual project as part of the definition of done; do not leave stale guidance behind.

## Architecture

- `src/components/Editor.svelte` owns editor interaction, canvas composition, and panels.
- `src/lib/types.ts` defines the versioned document, layers, transforms, and assets.
- `src/lib/effects.ts` defines the effect registry and ordered pixel-effect pipeline.
- `src/lib/project.ts` handles `.artmaker` archives, IndexedDB recovery, and format migration.

## Invariants

- Convert physical dimensions to pixels with the document DPI and include all four bleed edges.
- New documents default to 64×89 mm at 300 DPI with 3 mm bleed on each edge.
- Preserve imported image originals. Never replace source bytes with a transformed or resampled copy.
- Transform raw layer content into document space before applying its effect stack.
- Linked layers share the source layer's raw pixel buffer. Each keeps its own transform, effects, opacity, blend mode, and mask.
- Pixel tools cannot edit a linked layer's pixels. They can edit that layer's mask. Content replace writes to the source layer and updates every layer linked to it.
- Deleting a source layer unlinks dependents and copies the last shared pixels onto them.
- Convert document-space pointer coordinates through the active layer's inverse transform before editing its raw pixels. Canvas-space masks paint in document pixels.
- The select tool shows the active layer's opaque-content bounds. Corner handles scale proportionally; edge handles scale X or Y only. The opposite side stays fixed.
- Import draws into the layer buffer at 1:1 unless both source dimensions exceed the canvas, in which case it contain-fits so both sides fit.
- Undo/redo restores a layer's bitmap, transform, and mask together. Linked-layer undo restores transform and mask only.
- Apply enabled effects strictly in their displayed order.
- Halftone is a document-origin, integer-pixel square alpha mask; spacing is the empty gap between dots.
- Contour builds a signed distance field from painted alpha (or Rec.709 luminance when the layer is fully opaque) and draws anti-aliased isolines, so strokes on a transparent layer fill the canvas with a topographic pattern.
- Colorize takes hue and saturation from its configured color and lightness from the Rec.709 grayscale source after the lightness adjustment.
- A layer mask multiplies the host alpha. Layer-space masks apply before the host transform; canvas-space masks apply after. Switching space rebakes pixels so the mask stays put on the canvas.
- Selecting a mask enters edit mode: only the host layer is composited. Showing mask pixels is an edit-mode preview and is omitted from PNG export.
- When changing serialized document structures, add an explicit migration and update round-trip tests.
- Keep canvas interactions pixel-perfect at zoom levels of 100% and above.
- Square brush stamps an integer-pixel hard rectangle; round brush uses hardness.
- Rectangle and ellipse tools have independent fill and stroke colors with alpha; alpha 0 disables that channel.
