# MoonClaw 🌕

An interactive, full-screen 3D Moon you can spin, zoom, and explore — then pull back past
Earth to tour the whole solar system. Built with [Three.js](https://threejs.org/) and
[Vite](https://vite.dev/), deployed on [Vercel](https://vercel.com/).

## Features

- **High-resolution Moon** rendered from NASA Lunar Reconnaissance Orbiter imagery:
  - an **8K (8192×4096) LROC color mosaic** on desktop,
  - a **normal map computed from LOLA laser-altimeter elevation data** (16 px/degree, ≈ 1.9 km/px),
    so craters, rims, and ridges have real depth that shifts as you rotate and zoom.
  - Progressive loading: 2K color + 2K normal map appear first, then the sharper maps swap in.
    Desktops with 8K texture support get 8K color + 5760×2880 normal map (≈ 9 MB);
    phones and tablets get 4K color + 2K normal map (≈ 3 MB) to keep controls responsive.
  - Textures wrap across the ±180° seam (no visible line on the far side), and the
    minimum zoom distance is matched to the texture resolution that actually loaded.
- **Explore the solar system:** the **Explore Solar System** button pulls the camera back from
  the Moon, past Earth, to an overview of the Sun, all eight planets, the asteroid belt, and
  Pluto. Pick a body from the list or tap its label to fly closer and open a short info card.
  **Return to Moon** flies you back. The view is clearly labelled **Not to scale**; planet
  positions roughly follow their real orbital longitudes for today's date.
- **Keyboard:** **S** opens the solar system, **M** returns to the Moon, **R** resets / returns to the overview.
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
  - Respects `prefers-reduced-motion`: every camera move, including the Moon ↔ solar-system
    flights, becomes an instant cut, and planet spin is turned off. Forced-colors mode is supported too.
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

### Rebuilding the textures (optional)

The processed textures are committed, so you don't need this to run the site. To rebuild the
Moon maps, download `lroc_color_poles_8k.tif` and `ldem_16.tif` from the
[CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) into a folder, then:

```bash
node scripts/build-moon-textures.mjs path/to/folder   # color 2K/4K/8K + normal maps
node scripts/build-pluto-texture.mjs path/to/Pluto_color_mapmosaic.jpg
```

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
src/main.js             UI wiring, Moon/solar mode switching, keyboard controls, WebGL fallback
src/viewer.js           Three.js scene: Moon, texture tiers, camera flights, pins and labels
src/solar.js            Solar-system scene: Sun, planets, rings, orbits, asteroid belt
src/bodies.js           Solar-system data (layout + info card content)
src/landmarks.js        Landmark data (coordinates + info card content)
src/style.css           Styles (responsive + accessibility)
public/textures/        Moon color + normal maps, fallback image
public/textures/planets/  Sun, planet, and Pluto textures
scripts/build-moon-textures.mjs  Builds Moon color + normal maps from NASA SVS sources
scripts/tiff-float.mjs  Minimal reader for the LOLA float32 elevation TIFF
scripts/build-pluto-texture.mjs  Prepares the Pluto map (fills unimaged area)
scripts/make-fallback.mjs  Renders the static fallback image
```

## Credits

**Moon texture and elevation data:**
[CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) by Ernie Wright, **NASA’s Scientific
Visualization Studio** (released 2019).

- Color maps (`moon_color_8k.webp`, `moon_color_4k.jpg`, `moon_color_2k.jpg`) are made from
  `lroc_color_poles_8k.tif` (8192×4096). It's based on Lunar Reconnaissance Orbiter Camera
  (LROC) Wide Angle Camera mosaics, NASA / GSFC / Arizona State University.
- Normal maps (`moon_normal_6k.webp`, `moon_normal_2k.jpg`) are computed by MoonClaw from
  `ldem_16.tif`, the 16 px/degree Lunar Orbiter Laser Altimeter (LOLA) elevation map,
  NASA / GSFC. The relief is exaggerated 3× so it reads at globe scale.
- Both maps use the same simple-cylindrical layout centred on 0° longitude, so they line up
  with each other and with the landmark coordinates.

**Pluto:** [Global color map](https://commons.wikimedia.org/wiki/File:Pluto_color_mapmosaic.jpg)
from NASA's New Horizons mission, **NASA / Johns Hopkins University Applied Physics Laboratory /
Southwest Research Institute** (public domain). The part of Pluto New Horizons didn't image
(≈ 30% of the map, mostly the far south) is filled with a neutral tone. The fill is not real data.

**Sun and planets:** textures by [Solar System Scope](https://www.solarsystemscope.com/textures/),
based on NASA mission data and licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Files used: `2k_sun`,
`2k_mercury`, `2k_venus_atmosphere`, `2k_earth_daymap`, `2k_earth_clouds`, `2k_mars`,
`2k_jupiter`, `2k_saturn`, `2k_saturn_ring_alpha`, `2k_uranus`, `2k_neptune`. They were
re-encoded to WebP and otherwise left unchanged.

Planet facts come from NASA's planetary fact sheets and NASA Science solar system pages.

NASA imagery is generally not subject to copyright in the United States; see
[NASA’s media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
Use of NASA imagery doesn't imply NASA endorsement.

Landmark coordinates and facts come from NASA and the IAU Gazetteer of Planetary Nomenclature.

## License

Code is MIT-licensed. NASA imagery remains subject to the NASA terms above, and
the Solar System Scope textures remain under CC BY 4.0.
