// Solar-system bodies for the "Explore Solar System" view.
// Sizes and distances are NOT to scale — they're compressed so everything fits on screen.
//   radius  : scene units (the Moon is 1)
//   orbit   : distance from the Sun in scene units
//   L0, n   : mean longitude at J2000 (deg) and its daily rate (deg/day), used to place
//             each planet roughly where it really is around the current date.
export const BODIES = [
  {
    id: 'sun', name: 'The Sun', kind: 'Star · G-type main sequence', color: '#ffcf6e',
    radius: 55, orbit: 0, texture: 'sun.webp',
    subtitle: 'Centre of the solar system',
    body: 'A 4.6-billion-year-old ball of hydrogen and helium that holds 99.8% of the solar system’s mass. Fusion in its core powers every planet’s weather and every living thing on Earth.',
    facts: [['Diameter', '1.39 million km'], ['Surface temp.', '≈ 5,500 °C'], ['Light to Earth', '≈ 8 min 20 s']],
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'Planet · Rocky', color: '#b9b1a8',
    radius: 2.4, orbit: 120, L0: 252.25, n: 4.09233, tilt: 0.03, spin: 0.2, texture: 'mercury.webp',
    subtitle: '1st planet · 0.39 AU from the Sun',
    body: 'The smallest planet and the closest to the Sun. With almost no atmosphere, it swings from about 430 °C in daylight to −180 °C at night.',
    facts: [['Diameter', '4,879 km'], ['Day (sunrise to sunrise)', '176 Earth days'], ['Year', '88 Earth days'], ['Moons', '0']],
  },
  {
    id: 'venus', name: 'Venus', kind: 'Planet · Rocky', color: '#e8c58a',
    radius: 5.2, orbit: 180, L0: 181.98, n: 1.60213, tilt: 177.4, spin: -0.1, texture: 'venus.webp',
    subtitle: '2nd planet · 0.72 AU from the Sun',
    body: 'Earth’s near-twin in size, wrapped in thick carbon-dioxide clouds. A runaway greenhouse effect makes it the hottest planet, at about 465 °C.',
    facts: [['Diameter', '12,104 km'], ['Rotation', '243 Earth days (backwards)'], ['Year', '225 Earth days'], ['Moons', '0']],
  },
  {
    id: 'earth', name: 'Earth', kind: 'Planet · Rocky', color: '#6fa8ff',
    radius: 5.4, orbit: 250, L0: 100.46, n: 0.98561, tilt: 23.44, spin: 1, texture: 'earth.webp', clouds: 'earth_clouds.webp',
    subtitle: '3rd planet · 1 AU from the Sun',
    body: 'Our home, and the only world known to host life. Liquid water covers about 71% of its surface. The Moon you started on orbits it every 27.3 days.',
    facts: [['Diameter', '12,742 km'], ['Day', '24 hours'], ['Year', '365.25 days'], ['Moons', '1']],
  },
  {
    id: 'mars', name: 'Mars', kind: 'Planet · Rocky', color: '#e07a4f',
    radius: 3.4, orbit: 320, L0: 355.43, n: 0.52403, tilt: 25.2, spin: 1, texture: 'mars.webp',
    subtitle: '4th planet · 1.52 AU from the Sun',
    body: 'A cold desert world colored by iron oxide dust. It has the solar system’s tallest volcano, Olympus Mons, and a canyon system longer than the United States is wide.',
    facts: [['Diameter', '6,779 km'], ['Day', '24 h 37 min'], ['Year', '687 Earth days'], ['Moons', '2 (Phobos, Deimos)']],
  },
  {
    id: 'belt', name: 'Asteroid Belt', kind: 'Region · Between Mars and Jupiter', color: '#a99a88',
    radius: 6, orbit: 430, L0: 100.46, n: 0, angleOffset: -32, belt: true,
    subtitle: '≈ 2.2 – 3.2 AU from the Sun',
    body: 'Millions of rocky leftovers from the solar system’s formation. Despite movie depictions it is mostly empty space — the asteroids are typically hundreds of thousands of kilometres apart.',
    facts: [['Largest object', 'Ceres (dwarf planet)'], ['Total mass', '≈ 3% of the Moon'], ['Known asteroids', '1+ million']],
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'Planet · Gas giant', color: '#d9b38c',
    radius: 22, orbit: 590, L0: 34.40, n: 0.08309, tilt: 3.1, spin: 2.4, texture: 'jupiter.webp',
    subtitle: '5th planet · 5.2 AU from the Sun',
    body: 'The largest planet — more than twice as massive as all the others combined. Its Great Red Spot is a storm wider than Earth that has raged for centuries.',
    facts: [['Diameter', '139,820 km'], ['Day', '9 h 56 min'], ['Year', '11.9 Earth years'], ['Moons', '95+ known']],
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'Planet · Gas giant', color: '#e3cf9a',
    radius: 19, orbit: 760, L0: 49.94, n: 0.03346, tilt: 26.7, spin: 2.2, texture: 'saturn.webp', rings: 'saturn_ring.webp',
    subtitle: '6th planet · 9.5 AU from the Sun',
    body: 'Famous for its rings of ice and rock, which span about 280,000 km but are mostly only tens of metres thick. Saturn is so light it would float in a big enough bathtub.',
    facts: [['Diameter', '116,460 km'], ['Day', '10 h 33 min'], ['Year', '29.4 Earth years'], ['Moons', '270+ known']],
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'Planet · Ice giant', color: '#9fe3e8',
    radius: 11, orbit: 920, L0: 313.23, n: 0.01173, tilt: 97.8, spin: -1.4, texture: 'uranus.webp',
    subtitle: '7th planet · 19.2 AU from the Sun',
    body: 'An ice giant that rolls around the Sun on its side, tipped about 98°. Methane in its atmosphere gives it a pale blue-green color.',
    facts: [['Diameter', '50,724 km'], ['Day', '17 h 14 min'], ['Year', '84 Earth years'], ['Moons', '28+ known']],
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'Planet · Ice giant', color: '#5b7bff',
    radius: 10.5, orbit: 1060, L0: 304.88, n: 0.00598, tilt: 28.3, spin: 1.5, texture: 'neptune.webp',
    subtitle: '8th planet · 30.1 AU from the Sun',
    body: 'The windiest world, with storms that reach 2,000 km/h. It was the first planet found by mathematical prediction rather than by looking.',
    facts: [['Diameter', '49,244 km'], ['Day', '16 h 6 min'], ['Year', '165 Earth years'], ['Moons', '16 known']],
  },
  {
    id: 'pluto', name: 'Pluto', kind: 'Dwarf planet · Kuiper Belt', color: '#d8c2a6',
    radius: 1.8, orbit: 1120, L0: 238.93, n: 0.00397, tilt: 0, spin: 0.1, texture: 'pluto.webp',
    // Real axial tilt is ~120°, but we keep it upright and turn the New Horizons 'heart' toward you.
    face: 0.5,
    ecc: 0.22, incl: 17.1, node: 110.3, peri: 224.1,
    subtitle: 'Dwarf planet · 39.5 AU (average) from the Sun',
    body: 'Reclassified as a dwarf planet in 2006. NASA’s New Horizons flew past in 2015 and revealed a bright, heart-shaped nitrogen-ice plain named Tombaugh Regio.',
    facts: [['Diameter', '2,377 km'], ['Day', '6.4 Earth days'], ['Year', '248 Earth years'], ['Moons', '5 (largest: Charon)']],
  },
];

/** Days since J2000.0 (2000-01-01 12:00 TT ≈ UTC) */
export const daysSinceJ2000 = (date = new Date()) => (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
