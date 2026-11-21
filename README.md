# MoonClaw 🌕

An interactive, full-screen 3D Moon you can spin, zoom, and explore — built with
[Three.js](https://threejs.org/) and [Vite](https://vite.dev/), deployed on [Vercel](https://vercel.com/).

## Features

- **Realistic Moon** rendered from NASA Lunar Reconnaissance Orbiter imagery, with
  elevation-based bump shading and a starfield backdrop. A 2K texture loads first;
  capable desktops upgrade to 4K automatically.
- **Drag to rotate, scroll or pinch to zoom** (mouse, trackpad, and touch).
- **Reset view** button that smoothly flies back to the near side.
- **Clickable landmarks** — Apollo 11 landing site, Sea of Tranquility, Tycho,
  Copernicus, Mare Imbrium, Apollo 17, and Shackleton crater (south pole). Pick one
  from the map pins or the Landmarks list and the camera flies to it and opens an
  info card.
- **Accessible controls**
  - All controls are real `<button>`s with labels, 44 px touch targets, and visible focus rings.
  - Keyboard: focus the Moon and use **arrow keys** to rotate (hold **Shift** for bigger steps),
    **+ / −** zoom, **R** resets, **A** toggles auto-rotate, **Esc** closes the info card.
  - Landmark list and skip link for screen-reader and keyboard users; status changes are
    announced through an `aria-live` region.
  - Respects `prefers-reduced-motion` (camera moves are instant) and forced-colors mode.
- **Works on mobile:** responsive layout, safe-area insets, and a lighter mesh and texture on small screens.
- **WebGL fallback:** if WebGL isn’t available, a pre-rendered still of the near side is shown
  and the landmark list and info cards keep working. There's also a `<noscript>` fallback.

## Tech stack

| Piece | Choice |
| --- | --- |
| Rendering | Three.js (`WebGLRenderer`, `OrbitControls`) |
| Build | Vite (static output in `dist/`) |
| Hosting | Vercel, auto-detected as a Vite project (no server code needed) |

## Run locally

Requires **Node.js 20+**.

```bash
git clone https://github.com/JackieTsiHuang/MoonClaw.git
cd MoonClaw
npm install
npm run dev        # dev server with hot reload at http://localhost:5173
```

Production build and preview:

```bash
npm run build      # outputs static files to dist/
npm run preview    # serves dist/ at http://localhost:4173
```

> **Windows PowerShell:** if `npm` is blocked by the execution policy, run `npm.cmd` instead
> (e.g. `npm.cmd run dev`).

### Regenerating the fallback image (optional)

`public/textures/moon_fallback.jpg` is rendered from the 4K color map:

```bash
node scripts/make-fallback.mjs
```

## Deploying

The repo is connected to Vercel, so every push to `main` triggers a production deploy.
Vercel auto-detects Vite: build command `npm run build`, output directory `dist`.

To deploy a fork yourself, import the repo at <https://vercel.com/new>, or run:

```bash
npx vercel        # preview deploy
npx vercel --prod # production deploy
```

## Project structure

```
index.html              App shell, HUD, controls, info card, fallback markup
src/main.js             UI wiring, keyboard controls, WebGL detection/fallback
src/viewer.js           Three.js scene: Moon, lighting, stars, camera, landmark pins
src/landmarks.js        Landmark data (coordinates + info card content)
src/style.css           Styles (responsive + accessibility)
public/textures/        Moon color maps, elevation map, fallback image
scripts/make-fallback.mjs  Renders the static fallback image
```

## Credits

**Moon texture and elevation data:**
[CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) by Ernie Wright, **NASA’s Scientific
Visualization Studio** (released 2019).

- Color maps (`moon_color_2k.jpg`, `moon_color_4k.jpg`) are derived from `lroc_color_2k.jpg`
  and `lroc_color_poles_4k.tif`. They're based on Lunar Reconnaissance Orbiter Camera
  (LROC) Wide Angle Camera mosaics, NASA / GSFC / Arizona State University.
- The elevation/bump map (`moon_displacement.jpg`, from `ldem_3_8bit.jpg`) is based on Lunar Orbiter
  Laser Altimeter (LOLA) data, NASA / GSFC.

NASA imagery is generally not subject to copyright in the United States; see
[NASA’s media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
Use of NASA imagery doesn't imply NASA endorsement.

Landmark coordinates and facts come from NASA and the IAU Gazetteer of Planetary Nomenclature.

## License

Code is MIT-licensed. Imagery remains subject to the NASA terms above.
