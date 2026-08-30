# PCB Silkscreen Knockout Generator

A browser-based tool for generating boxed, "knocked-out" PCB silkscreen labels in
real millimetres. It exports a high-DPI PNG that you feed into **KiCad's Image
Converter** (bitmap2component) to become `F.Silkscreen` graphics.

## Features

- **Configurable labels** — add/remove/reorder, per-label text, enable & box toggles.
- **Precise layout** — pitch (e.g. 2.54 mm), row/column arrangement, orientation, alignment
  (left/center/right × top/middle/bottom).
- **Graphics-based alignment** — aligns on the actual glyph ink, not font advance metrics.
- **Box / Plate** — per-label boxes, or a single "plate" one-big-box with individually
  roundable corners (e.g. two of four rounded).
- **Colors + alpha** — box, board, and text colors each with opacity, exported as RGBA PNG.
- **Custom fonts** — upload a `.ttf`/`.otf`/`.woff`; persists across reloads.
- **Precise sizing** — set the plate/canvas size in mm; the output matches what you measure.
- **High resolution** — export at high DPI (default 2400) with quality presets; only the
  aspect ratio matters because KiCad sets the physical size.
- **Auto-named export** — the downloaded PNG is named from the labels' text (e.g. `VBUS_GND.png`).

## Examples

Some of the silkscreen looks generated with the tool:

| Example 1 | Example 2 |
| :-: | :-: |
| ![Example 1](images/example_1.png) | ![Example 2](images/example_2.png) |

| Example 3 | Example 4 | Example 5 |
| :-: | :-: | :-: |
| ![Example 3](images/example_3.png) | ![Example 4](images/example_4.png) | ![Example 5](images/example_5.png) |

## Usage

1. `npm install`
2. `npm run dev` — open http://localhost:5173
3. Configure labels/layout/colors, then **⬇ Download PNG**.
4. In KiCad: **Image Converter** → choose the PNG → `F.Silkscreen`, Front → set the scale so
   the canvas maps to the **Box** size shown in the Export panel.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm test` — run the unit tests (vitest)
- `npm run preview` — preview the production build

## Stack

Vite · React · TypeScript (frontend only, no backend).
