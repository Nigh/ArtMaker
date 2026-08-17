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
- Import draws into the layer buffer at 1:1 unless both source dimensions exceed the canvas, in which case it contain-fits so both sides fit.
- Transform raw layer content into document space before applying its effect stack.
- Convert document-space pointer coordinates through the active layer's inverse transform before editing its raw pixels.
- Undo/redo restores a layer's bitmap and transform together.
- Apply enabled effects strictly in their displayed order.
- Halftone is a document-origin, integer-pixel square alpha mask; spacing is the empty gap between dots.
- Contour builds a signed distance field from painted alpha (or Rec.709 luminance when the layer is fully opaque) and draws anti-aliased isolines, so strokes on a transparent layer fill the canvas with a topographic pattern.
- Colorize takes hue and saturation from its configured color and lightness from the Rec.709 grayscale source after the lightness adjustment.
- When changing serialized document structures, add an explicit migration and update round-trip tests.
- Keep canvas interactions pixel-perfect at zoom levels of 100% and above.
