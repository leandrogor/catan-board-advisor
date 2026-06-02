# PROJECT_SKILL.md — Catan Board Advisor

> **Purpose**: Onboarding document for AI assistants working on this codebase.
> **Last updated**: 2026-06-01 (incorporating Drag-and-Drop Deserts, Phase-aware Undo/Redo, Standardized Monte Carlo Simulation, and Hex Info Panels)

---

## 1. Project Overview

**Catan Board Advisor** is an Angular 21 web application that helps players of the **Catan 5-6 Player Extension** (30-hexagon board) find optimal initial settlement placements. It runs a **Monte Carlo simulation** (1000 mini-games of 150 rolls each) and produces a ranked heatmap of every intersection vertex.

**Live URL**: `https://[username].github.io/catan-board-advisor/`

### Key technologies

| Tool            | Version                       | Notes                                                        |
| --------------- | ----------------------------- | ------------------------------------------------------------ |
| Angular         | 21.2.x                        | **Zoneless** (no zone.js), Signals only                      |
| TypeScript      | 5.9.x                         | `strict: true`, `noUnusedLocals`, `noUnusedParameters`       |
| Tailwind CSS    | 4.x                           | PostCSS integration via `@tailwindcss/postcss`, no JS config |
| Package manager | pnpm                          | Configured in `angular.json` `cli.packageManager`            |
| Testing         | Karma + Jasmine               | Default Angular test runner                                  |
| PWA             | @angular/service-worker       | ngsw-config.json + manifest.webmanifest                      |
| Deployment      | GitHub Actions → GitHub Pages | `peaceiris/actions-gh-pages@v4`                              |
| Linting         | ESLint 10+ (Flat Config)      | Configured in `eslint.config.js`                             |

### Critical architectural rules

1. **ALL components are `standalone: true`** — zero NgModules anywhere
2. **State management: Angular Signals exclusively** — `signal()`, `computed()`, `effect()`. No RxJS for local state, no NgRx, no BehaviorSubject
3. **No `any` type** — TypeScript strict mode throughout
4. **pnpm only** — never npm. `angular.json` has `"packageManager": "pnpm"`

---

## 2. Complete File Structure

```
catan-board-advisor/
├── .github/workflows/deploy.yml          # CI/CD: GitHub Pages deployment
├── .husky/pre-commit                     # Git hook: runs `npx lint-staged`
├── .postcssrc.json                       # PostCSS config for Tailwind v4
├── .prettierrc                           # Prettier: 100 cols, single quotes, trailing commas
├── angular.json                          # Angular CLI config (pnpm, karma, service worker)
├── eslint.config.js                      # Flat Config for ESLint 10+
├── lint-staged.config.js                 # eslint+prettier on staged files
├── package.json                          # engines: node>=22, scripts: start/build/test/lint
├── tsconfig.json                         # strict, noUnusedLocals, noUnusedParameters
├── tsconfig.app.json                     # extends tsconfig.json for app build
├── tsconfig.spec.json                    # extends tsconfig.json for tests
│
├── public/
│   └── favicon.ico                       # Default Angular favicon
│
├── src/
│   ├── index.html                        # PWA meta tags, Inter font, iOS Safari support
│   ├── main.ts                           # Bootstrap: AppComponent + appConfig
│   ├── styles.css                        # Tailwind v4 @import + CSS custom properties
│   ├── manifest.webmanifest              # PWA manifest (standalone, portrait, amber theme)
│   ├── ngsw-config.json                  # Service worker precache config
│   │
│   ├── assets/icons/
│   │   ├── icon-192.png                  # PWA icon 192x192
│   │   └── icon-512.png                  # PWA icon 512x512
│   │
│   └── app/
│       ├── app.component.ts              # Root: just <router-outlet />
│       ├── app.component.spec.ts         # Basic creation test
│       ├── app.config.ts                 # Providers: zoneless CD, hash routing, service worker
│       ├── app.routes.ts                 # ShellComponent + lazy board-advisor
│       │
│       ├── core/services/
│       │   ├── translation.service.ts    # Signal-based i18n (EN/ES), localStorage
│       │   └── theme.service.ts          # Dark/light theme, prefers-color-scheme, localStorage
│       │
│       ├── shared/utils/
│       │   └── hex-math.utils.ts         # ALL hex grid geometry & spiral layout (see §3)
│       │
│       ├── shell/
│       │   └── shell.component.ts        # App shell: header, settings drawer, router-outlet
│       │
│       └── features/board-advisor/
│           ├── board-advisor.routes.ts             # Lazy route → BoardAdvisorPageComponent
│           ├── board-advisor-page.component.ts     # Page compositor (two-column desktop / single-column mobile)
│           │
│           ├── models/
│           │   ├── hex.model.ts                    # HexLetter (30 values), HexDefinition
│           │   ├── vertex.model.ts                 # Vertex, ReachableVertex (stub), BoardStateSnapshot (stub)
│           │   └── simulation-result.model.ts      # SimulationResult
│           │
│           ├── data/
│           │   ├── ext-catan-letter-values.data.ts # Letter→dice number map (verified from physical game)
│           │   └── ext-catan-board-layout.data.ts  # 7-row grid, DesertPositions interface, defaults
│           │
│           ├── i18n/
│           │   ├── en.translations.ts              # Translations interface + EN constant (44 keys)
│           │   └── es.translations.ts              # ES constant (imports Translations from en)
│           │
│           ├── services/
│           │   ├── board-layout.service.ts          # Builds HexDefinition[] from layout data
│           │   ├── simulation.service.ts            # Monte Carlo 1000-mini-game simulation (see §6)
│           │   └── board-state.store.ts             # Central Signal-based store (see §4)
│           │
│           └── components/
│               ├── board/
│               │   ├── board.component.ts           # SVG board renderer (drag-and-drop, text rotation) (see §5)
│               │   └── board.component.html         # SVG template: hexes, vertices, and drag ghosts
│               ├── vertex-indicator/
│               │   └── vertex-indicator.component.ts # Stub for future modularity
│               ├── vertex-detail-panel/
│               │   └── vertex-detail-panel.component.ts # Bottom sheet with vertex rank/score detail
│               ├── board-controls/
│               │   └── board-controls.component.ts  # Undo/redo/rotate bar (mobile sticky)
│               └── hex-info-panel/
│                   └── hex-info-panel.component.ts  # Bottom sheet with hex letter/number stats
```

### File purpose quick reference

| File                               | One-liner                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `hex-math.utils.ts`                | Pure functions: hex coordinates, vertices, deduplication, adjacency, viewBox, heatmap, spiral mapping |
| `board-state.store.ts`             | Single source of truth: 15 signals + 8 computed. Phase-aware undo/redo stacks and actions.            |
| `simulation.service.ts`            | Stateless: runs 1000 mini-games (150 rolls/game), returns SimulationResult                            |
| `board-layout.service.ts`          | Stateless: takes desert positions + R, returns HexDefinition[]                                        |
| `board.component.ts+html`          | SVG rendering: hexes, vertices, Pointer Events drag-and-drop, label upright rotation, scale           |
| `vertex-detail-panel.component.ts` | Detail drawer showing vertex score, ranking, adjacent tiles, and settlement toggle                    |
| `hex-info-panel.component.ts`      | Detail drawer showing hex letters, dice numbers, theoretical probability, roll frequency              |
| `shell.component.ts`               | App chrome: header (lang/theme/settings toggles) + settings drawer                                    |

---

## 3. Hex Grid Math & Spiral Mapping (hex-math.utils.ts)

### Coordinate system

**Orientation**: Pointy-top hexagons (vertex at top and bottom, flat edges left/right). This matches the physical Catan board.

**Grid structure**: 7 rows with sizes `[3, 4, 5, 6, 5, 4, 3]` (row 3 is the widest at 6 hexes).

**Circumradius `R`**: Computed adaptively to fit the board. The widest row (6 hexes) determines the maximum:

```
R = min(viewportWidth * 0.95, 520) / (6 * √3)
```

### Hex center computation

```
hexSpacingX = R * √3           // horizontal distance between hex centers in a row
rowSpacingY = R * 1.5           // vertical distance between row centers
startXForRow(r) = (6 - rowSizes[r]) * hexSpacingX / 2   // center-align against widest row

centerX(row, col) = startXForRow(row) + col * hexSpacingX
centerY(row)      = row * rowSpacingY
```

### Six vertices of a pointy-top hex at (cx, cy)

Angles (degrees): `[90, 30, -30, -90, -150, 150]`

```
vertex[i].x = cx + R * cos(angle_rad)
vertex[i].y = cy - R * sin(angle_rad)     // SVG y-axis inverted
```

Resulting positions:

```
V0 (top):         (cx,            cy - R)
V1 (upper-right): (cx + R√3/2,    cy - R/2)
V2 (lower-right): (cx + R√3/2,    cy + R/2)
V3 (bottom):      (cx,            cy + R)
V4 (lower-left):  (cx - R√3/2,    cy + R/2)
V5 (upper-left):  (cx - R√3/2,    cy - R/2)
```

### Vertex deduplication algorithm

30 hexes × 6 vertices = 180 raw positions, but many are shared. Deduplication:

1. For each hex, compute its 6 vertex positions
2. Round coordinates to 1 decimal place and create a key: `"${Math.round(x*10)}-${Math.round(y*10)}"`
3. If key exists in vertexMap → push hex ID into existing vertex's `adjacentHexIds`
4. If key is new → create new `Vertex` with `id = "v-${key}"`

**Result**: ~84 unique vertices.

**Why rounding to 1 decimal**: Floating-point precision means shared vertices computed from adjacent hexes won't be exactly equal. Multiplying by 10 and rounding ensures a ≤0.05px tolerance — sufficient for hex grids where the minimum vertex distance is `R` (~40-50px).

**Known consideration**: If `R` changes (e.g., window resize), all vertex IDs change because the key includes pixel coordinates. The entire vertex graph is recomputed via `computed()` signals, which is correct behavior.

### Vertex-to-vertex adjacency (distance rule)

Two vertices are adjacent if they are consecutive vertices of the same hex (connected by a hex edge):

```
for each hex H:
  compute 6 vertex positions → look up deduplicated vertex IDs
  for i in 0..5:
    connect vertex[i] ↔ vertex[(i+1) % 6]  (bidirectional, deduped)
```

This is stored in each vertex's `adjacentVertexIds[]` and used for the **settlement distance rule**: when a settlement is placed, all adjacent vertices become `isBlocked = true`.

### ViewBox computation

The SVG viewBox is computed from the bounding box of ALL vertex positions (not just hex centers) with 20px padding on each side. This is done via `computeViewBox()`.

### Heatmap color interpolation

```
normalizedScore 0.0 → 0.5:  blue (#3b82f6) → yellow (#fbbf24)
normalizedScore 0.5 → 1.0:  yellow (#fbbf24) → red (#ef4444)
```

Linear RGB interpolation. Pure function `interpolateHeatmapColor(normalizedScore)`.

### Spiral Letter Assignment

To map lettered tokens in a counterclockwise spiral from top-right to bottom-left:

1. Define a static `SPIRAL_ORDER` list of row-col coordinates mapping out the spiral paths.
2. Filter out the coordinates corresponding to the active `desertPositions` (since deserts do not have letter tokens assigned).
3. Associate each of the remaining coordinates with the alphabetized series of 28 Catan letter tokens (`A` to `Zc`).
4. Return a map of `"${row}-${col}"` to letter string. This layout is dynamically recalculated via `spiralLetterAssignment` whenever deserts are repositioned.

---

## 4. Signal-Based State Flow (board-state.store.ts)

### Signal graph

```
                                    ┌─────────────────────┐
                                    │  desertPositions()   │ ← updateDesertPosition() / drag-and-drop
                                    │  hexSize()           │ ← updateHexSize()
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  hexes (computed)    │ ← BoardLayoutService.buildHexGrid()
                                    └──────────┬──────────┘
                                               │
                              ┌────────────────┼───────────────────┐
                              │                │                   │
                   ┌──────────▼──────────┐     │        ┌──────────▼──────────┐
                   │  allVertices         │     │        │  viewBox (computed) │
                   │  (computed)          │     │        └─────────────────────┘
                   │  dedup + adjacency   │     │
                   └──────────┬──────────┘     │
                              │                │
                    ┌─────────▼─────────┐      │
                    │  startSimulation  ├──────┘  ← Manual trigger
                    │  (Phase 1 → 2)    │
                    └─────────┬─────────┘
                              │
                   ┌──────────▼──────────┐
                   │ _simulationResult   │  (private writable signal)
                   │  .asReadonly()      │
                   └──────────┬──────────┘
                              │
                   ┌──────────▼──────────┐     ┌────────────────────────┐
                   │  scoredVertices     │◄────│  settledVertexIds()    │ ← placeSettlement() / undo / redo
                   │  (computed)         │     └────────────────────────┘
                   │  applies occupied/  │
                   │  blocked state      │
                   └──────────┬──────────┘
                              │
                   ┌──────────▼──────────┐
                   │  rankedVertices     │  re-ranks eligible vertices after settlement changes
                   │  (computed)         │
                   └──────────┬──────────┘
                              │
                   ┌──────────▼──────────┐
                   │  topVertex          │  find(v => v.rank === 1)
                   │  (computed)         │
                   └─────────────────────┘
```

### All signals in the store

**Writable signals (source of truth):**
| Signal | Type | Default | Persisted |
|--------|------|---------|-----------|
| `desertPositions` | `DesertPositions` | `{L1: {3,3}, L2: {4,2}}` | No |
| `settledVertexIds` | `string[]` | `[]` | No |
| `placedRoads` | `{ from: string; to: string }[]` | `[]` | No |
| `undoStack` | `ActionSnapshot[]` | `[]` | No (Phase 2 transaction undo) |
| `redoStack` | `ActionSnapshot[]` | `[]` | No (Phase 2 transaction redo) |
| `desertUndoStack` | `DesertPositions[]` | `[]` | No (Phase 1 desert undo) |
| `desertRedoStack` | `DesertPositions[]` | `[]` | No (Phase 1 desert redo) |
| `selectedVertexId` | `string \| null` | `null` | No |
| `selectedHexId` | `string \| null` | `null` | No |
| `boardRotationDeg` | `0\|90\|180\|270` | `0` | No |
| `isSimulating` | `boolean` | `false` | No |
| `hexSize` | `number` | computed from viewport | No |
| `appPhase` | `AppPhase` (`'setup'\|'results'`) | `'setup'` | No |
| `showNumbersInSetup`| `boolean` | `false` | No |
| `scoreFormat` | `'decimal'\|'percentage'` | `'decimal'` | localStorage `catan-score-fmt` |
| `showZeroScores` | `boolean` | `true` | localStorage `catan-show-zeros` |
| `isSelectingRoad` | `boolean` | `false` | No |
| `pendingSettlementVertexId` | `string \| null` | `null` | No |
| `currentRoadOptions` | `RoadOption[]` | `[]` | No |
| `_simulationResult` | `SimulationResult \| null` | `null` | No (private) |

**Computed signals (derived):**
| Signal | Depends on | Purpose |
|--------|------------|---------|
| `hexes` | desertPositions, hexSize | Build hex grid via BoardLayoutService |
| `spiralLetterAssignment` | desertPositions | Maps row-col to current letter label based on spiral rules |
| `allVertices` | hexes, hexSize | Deduplicate + build adjacency graph |
| `scoredVertices` | allVertices, simulationResult, settledVertexIds | Apply simulation scores + settlement state |
| `rankedVertices` | scoredVertices, hexes | Re-rank eligible after settlements |
| `topVertex` | rankedVertices | Vertex with rank === 1 |
| `viewBox` | hexes, hexSize | SVG viewBox dimensions |
| `simulationResult` | \_simulationResult (readonly view) | Public API |

**Effects (side effects):**
| Effect | Trigger | Action |
|--------|---------|--------|
| Score format persist | `scoreFormat()` | Write to localStorage |
| Show zeros persist | `showZeroScores()` | Write to localStorage |

### Critical data flow: what happens when a desert is moved in Setup

1. Desert is dragged on SVG and dropped on a new hexagon.
2. `updateDesertPosition('L1', {row, col})` is triggered:
   - The current `desertPositions` snapshot is pushed onto `desertUndoStack`.
   - `desertRedoStack` is cleared.
   - If the new coordinate matches the other desert, they swap. Otherwise, the desert is moved.
   - `settledVertexIds`, `undoStack`, `redoStack`, `selectedHexId` and `showNumbersInSetup` are reset.
3. `hexes`, `spiralLetterAssignment`, and `allVertices` computed signals re-evaluate.
4. The board updates visually (empty desert tile moves, letters reflow spiral paths, selection closes).

### Undo/Redo implementation

The store manages **phase-aware** undo/redo stacks:

- **Phase 1 (Setup)**:
  - Working with desert placements: `desertUndoStack` and `desertRedoStack`.
  - Actions push a copy of `DesertPositions` to the undo stack.
  - Clicking Undo pops from `desertUndoStack`, updates `desertPositions`, and pushes the previous state to `desertRedoStack`.
- **Phase 2 (Results)**:
  - Working with settlements and roads: `undoStack` and `redoStack` storing arrays of `ActionSnapshot` representing settled vertex IDs and placed roads.
  - Placing/removing a settlement (which is grouped with a road selection) pushes the current state of both to `undoStack` and clears `redoStack` to revert them transactionally.

### Road Planning and Selection Flow

1. **Scoring Algorithm**:
   - For a selected vertex $V$ and each adjacent vertex $A$:
     - Check adjacent vertices $B$ of $A$ (excluding $V$ and occupied vertices).
     - If $B$ is unblocked, it is a valid target at `cost = 1`.
     - If $B$ is blocked, look at its adjacent vertices $C$ (excluding $A$, $V$, occupied, and blocked). If found, they are targets at `cost = 2` (requiring `+1 Road`).
     - Options are ranked first by `cost` (lower is better) and then by projected target score descending.
     - `pathScore` is strictly equal to the projected target's score.
2. **Selection Flow & ViewBox Zoom**:
   - Clicking **Place Settlement** starts road selection (`isSelectingRoad = true`).
   - The board dynamically shifts the SVG `viewBox` centered on $V$. On mobile, it offsets the vertical center upwards to prevent the bottom sheet modal from blocking the interactive road elements.
   - Interactive road options are rendered with rounded-cap lines and midpoint rank badges, alongside dashed projection paths leading to the target settlement location.
   - Confirming a road direction records the settlement at $V$ and the road in `placedRoads` as a unified transaction.

---

## 5. SVG Rendering & Drag-and-Drop (board.component.ts + .html)

### Rendering pipeline

The board is a single `<svg>` element with two rendering passes:

1. **Hex polygons** — `@for (hex of store.hexes(); track hex.id)`
2. **Vertex circles** — `@for (vertex of displayVertices(); track vertex.id)`

Vertices are rendered AFTER hexes so they appear on top (SVG painter's model).

### Hex rendering

Each hex is a `<polygon>` with 6 points computed by `hexPolygonPoints()`:

- Fill: CSS variable `--hex-fill` (light) or `--hex-desert-fill` (desert)
- Stroke: CSS variable `--hex-stroke`
- Center text shows letter or number. The user can toggle between letters and numbers by clicking any hex during setup (which triggers a global toggle `showNumbersInSetup` in the store).
- Numbers 6 and 8: `fill: var(--hex-number-hot)` (#dc2626 red), `font-weight: bold`
- Desert: shows 🏜️ emoji instead of number

### Interactive Desert Drag-and-Drop (Pointer Events API)

- Deserts are rendered with `cursor: grab` (`cursor: grabbing` on active touch/click).
- On `pointerdown` on a desert tile, pointer capture is set.
- A **ghost desert tile** (`<g class="ghost-desert">`) is rendered at the current cursor position. It tracks the mouse movement using coordinates translated via the SVG inverse transform matrix:
  ```typescript
  const ctm = svg.getScreenCTM();
  const inv = ctm.inverse();
  const svgX = inv.a * clientX + inv.c * clientY + inv.e;
  ```
- Nearby hexes undergo a distance-based hit-test to find the closest drop target:
  ```typescript
  const dist = Math.hypot(hex.center.x - svgX, hex.center.y - svgY);
  // Highlight if dist < R * 1.15
  ```
- On `pointerup`, the desert is moved to the target hex, and the ghost preview is destroyed.

### Hex and Vertex Labels & Interactions

- **Probability-Based Font Size Scaling**: Numbers on hexagons are scaled based on the ways to roll them:
  ```typescript
  const scale = 0.55 + 0.45 * ((ways - 1) / 4);
  const fontSize = base * scale;
  ```
  This reduces the contrast between the largest and smallest numbers so that smaller values (2, 12) remain readable.
- **Label Counter-Rotation**: All text elements (numbers, letters, emojis) are counter-rotated dynamically using `rotate(${-deg}, ${cx}, ${cy})` to stay upright when the board is visually rotated.
- **Vertex visual states**:
  - _Normal_: Heatmap circle, radius scaled by score (from 4px to 12px), filled with interpolation.
  - _Top-ranked (rank=1)_: Pulsing orange stroke ring + ★ text.
  - _Top 5_: White rank number text inside circle.
  - _Selected_: White stroke ring overlay.
  - _Occupied_: Indigo fill + 🏠 emoji overlay.
  - _Blocked_: Gray fill (#94a3b8), opacity 0.35, pointer events disabled.

---

## 6. The Simulation Engine (simulation.service.ts)

### Algorithm

```
INPUT:  hexes: HexDefinition[], vertices: Vertex[]
OUTPUT: SimulationResult { totalMiniGames, rollCountMap, resourceMap, maxRawScore, rankedVertexIds }

1. Initialize lookup tables:
   - numberToHexIds: Map<diceNumber, hexId[]>
   - vertexAdjacentHexSet: Map<vertexId, Set<hexId>>
   - miniGameScores: Map<vertexId, number[]>

2. Loop 1000 times (TOTAL_MINI_GAMES):
   - Initialize gameResources Map: vertexId → 0
   - Loop 150 times (ROLLS_PER_GAME):
     - Roll dice: roll = random(1-6) + random(1-6)
     - Skip if roll === 7 (robber)
     - Increment rollCountMap.get(roll)
     - For each vertex, check adjacent producing hexes for that roll
     - Add resource count (if any) to gameResources
   - Save resource rate (gameResources / 150) to miniGameScores for each vertex

3. Calculate average resources-per-roll:
   - rawScore = average of all 1000 mini-game scores
   - totalResources = rawScore * 150 (representative resources per 150-roll game)
   - normalizedScore = rawScore / maxRawScore (0-1 range)

4. Rank eligible vertices:
   - Filter: !blocked, !occupied, adjacent to at least one non-desert hex
   - Sort by rawScore descending
   - Assign rank 1, 2, 3...
```

### Performance & Integration

- Wrapped inside a `setTimeout(0)` asynchronously to allow Angular to render the "Simulating..." spinner before blocking the thread.
- Total complexity: ~O(1000 × 150 × 84 × ~3) ≈ 3.7M iterations. Runs in ~10-25ms.
- To prevent mutating source vertices during simulation, the store copies vertices before invoking the service.

---

## 7. Board Data (verified from physical game)

### Letter-to-number mapping

28 lettered hex tokens + 2 desert tokens. Letters A-Y are unique; Za/Zb/Zc are the three "Z" tokens.

```
A:2  B:5  C:4  D:6  E:3  F:9  G:8  H:11 I:11 J:10
K:6  L:3  M:8  N:4  O:8  P:10 Q:11 R:12 S:10 T:5
U:4  V:9  W:5  X:9  Y:12 Za:3 Zb:2 Zc:6
L1:null (desert)  L2:null (desert)
```

### Board layout (counterclockwise spiral from top-right)

```
Row 0 (3 hexes): C   B   A
Row 1 (4 hexes): D   R   Q   P
Row 2 (5 hexes): E   S   Zb  Za  O
Row 3 (6 hexes): F   T   Zc  L1  Y   N     ← widest row
Row 4 (5 hexes): G   U   L2  X   M
# ...
```

Default desert positions: L1 at (3,3), L2 at (4,2).

---

## 8. Routing & Architecture

```
'' → ShellComponent (header + settings + router-outlet)
  └── '' → lazy load board-advisor.routes.ts
        └── '' → lazy load BoardAdvisorPageComponent
```

- **Hash routing** (`withHashLocation()`) for GitHub Pages compatibility.
- **Lazy loading** via `loadChildren` / `loadComponent`.

---

## 9. Theming & i18n

### Theme system

- `ThemeService` manages a `signal<'light' | 'dark'>` saved in `catan-theme`.
- Sets `.dark` class on `document.documentElement`.
- Tailwind v4 custom variant handles SVG CSS variables.

### i18n system

- `TranslationService` manages a `signal<'en' | 'es'>` saved in localStorage.
- `computed<Translations>` returns EN or ES translations (44 keys).

---

## 10. Known Limitations & Edge Cases

### Current limitations

1. **Simulation is non-deterministic**: Runs produce slightly different rankings due to random rolls. This is statistically expected.
2. **No viewport resize handling**: `hexSize` is computed once from `window.innerWidth` at store initialization. If the window is resized, the board does not dynamically scale until reload.
3. **Vertex detail panel transition**: The bottom sheet uses `transform: translateY` but appears immediately via `@if` conditional rendering without smooth animation.

### Edge cases in the domain logic

1. **Desert-only vertices**: A vertex touching only desert hexes gets `rank: null` and `normalizedScore: 0`.
2. **Multiple hexes with same dice number**: Correctly tracked (e.g. vertex between two 8s scores twice on 8).
3. **All vertices blocked**: If settlements block all remaining vertices, `rankedVertices` returns an empty eligible list and `topVertex` is null.

---

## 11. Build & Development Commands

```bash
# Install dependencies
pnpm install

# Development server (http://localhost:4200/)
pnpm start

# Production build for GitHub Pages
pnpm ng build --base-href /catan-board-advisor/ --configuration production

# Run tests
pnpm test

# Lint
pnpm lint
```

### Build output location

- Development: `dist/catan-board-advisor/`
- Production: `dist/catan-board-advisor/browser/`

---
