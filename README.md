# ArtMaker

ArtMaker is an offline-first, print-ready canvas editor for cards and other small-format artwork. It understands physical trim size, independent bleed margins and DPI, then renders exact output pixel dimensions.

## Features

- Millimetre and inch sizing with configurable DPI, bleed and safe-area guides
- Paint, image and basic text layers with original image assets retained
- Ordered non-destructive effects: colorize, gradient map, halftone, arrays, contours, stroke, shadow, blur, levels and threshold
- `.artmaker` ZIP project files, PNG export and IndexedDB autosave
- Chinese/English UI, xianii light/dark themes and installable PWA

## Development

```sh
npm install
npm run dev
```

Use `npm test` for unit tests and `npm run build` for a production build.

## License

[MIT](LICENSE)
