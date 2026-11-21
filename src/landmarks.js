// Selenographic coordinates: latitude (+N / −S), longitude (+E / −W), in degrees.
export const LANDMARKS = [
  {
    id: 'apollo-11',
    name: 'Apollo 11 Landing Site',
    kind: 'Crewed landing · July 20, 1969',
    lat: 0.6741,
    lon: 23.473,
    body:
      'Tranquility Base, where Neil Armstrong and Buzz Aldrin became the first humans to walk on the Moon while Michael Collins orbited overhead in Columbia.',
    facts: [
      ['Lunar module', 'Eagle'],
      ['Time on surface', '21 h 36 min'],
      ['Samples returned', '21.5 kg'],
    ],
  },
  {
    id: 'tranquility',
    name: 'Sea of Tranquility',
    kind: 'Lunar mare · Mare Tranquillitatis',
    lat: 8.5,
    lon: 31.4,
    body:
      'A vast basin flooded by ancient basaltic lava. Its slightly bluish tint comes from titanium-rich minerals. Despite the name, it holds no water.',
    facts: [
      ['Diameter', '≈ 873 km'],
      ['Age', '≈ 3.6–3.9 billion years'],
      ['Named by', 'Riccioli & Grimaldi, 1651'],
    ],
  },
  {
    id: 'tycho',
    name: 'Tycho Crater',
    kind: 'Impact crater · Southern highlands',
    lat: -43.31,
    lon: -11.36,
    body:
      'One of the youngest large craters on the near side. Its bright rays of ejecta stretch up to 1,500 km and are visible from Earth with binoculars around full Moon.',
    facts: [
      ['Diameter', '≈ 85 km'],
      ['Age', '≈ 108 million years'],
      ['Visited by', 'Surveyor 7 (1968)'],
    ],
  },
  {
    id: 'copernicus',
    name: 'Copernicus Crater',
    kind: 'Impact crater · Oceanus Procellarum',
    lat: 9.62,
    lon: -20.08,
    body:
      'Nicknamed the “Monarch of the Moon,” Copernicus has terraced walls and central peaks rising over 1 km from its floor.',
    facts: [
      ['Diameter', '≈ 93 km'],
      ['Depth', '≈ 3.8 km'],
      ['Age', '≈ 800 million years'],
    ],
  },
  {
    id: 'imbrium',
    name: 'Sea of Showers',
    kind: 'Lunar mare · Mare Imbrium',
    lat: 32.8,
    lon: -15.6,
    body:
      'The second-largest mare, carved by a colossal impact and later filled with lava. Its dark plain forms the “right eye” of the Man in the Moon.',
    facts: [
      ['Diameter', '≈ 1,146 km'],
      ['Visited by', 'Luna 17, Chang’e 3'],
      ['Rover', 'Lunokhod 1, Yutu'],
    ],
  },
  {
    id: 'apollo-17',
    name: 'Apollo 17 Landing Site',
    kind: 'Crewed landing · December 11, 1972',
    lat: 20.1908,
    lon: 30.7717,
    body:
      'The Taurus–Littrow valley, site of the last crewed lunar landing to date. Geologist Harrison Schmitt discovered orange volcanic glass here.',
    facts: [
      ['Crew on surface', 'Cernan & Schmitt'],
      ['Time on surface', '≈ 75 hours'],
      ['Samples returned', '110.5 kg'],
    ],
  },
  {
    id: 'shackleton',
    name: 'Shackleton Crater',
    kind: 'Impact crater · South Pole',
    lat: -89.67,
    lon: 129.78,
    body:
      'Sitting almost exactly on the lunar south pole, its interior lies in permanent shadow and may trap water ice — a prime target for future crewed missions.',
    facts: [
      ['Diameter', '≈ 21 km'],
      ['Depth', '≈ 4.2 km'],
      ['Interior temp.', 'below −170 °C'],
    ],
  },
];

export function formatCoords(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}
