# PROJECT_SKILL.md — Catan Board Advisor

> **Purpose**: Onboarding document for AI assistants working on this codebase.
> **Last updated**: 2026-08-02 (Mobile hold-to-act gestures & progress animations, multi-builder radial selection picker, native touch callout protection, edge pickers, win condition freeze checks, customizable road expansion target selector, Escape key hex/vertex deselect)

---

## 1. Project Overview

**Catan Board Advisor** is an Angular 21 web application that helps players of both the **Base Catan Board (3-4 players)** and **Catan 5-6 Player Extension** find optimal initial settlement placements, plan expansion routes, and track live gameplay metrics.

By selecting the player count, the application dynamically adjusts the entire board layout:

- **3-4 Players**: Renders the standard Base Board (19-hexagon grid, 1 desert).
- **5-6 Players**: Renders the Extension Board (30-hexagon grid, 2 deserts).

It operates across three distinct phases:

1. **Board Setup (Phase 1)**: Interactively position desert tiles, rotate the board, toggle labels, or load a saved session.
2. **Initial Placements (Phase 2)**: Runs a **Monte Carlo simulation** (10,000 mini-games of player-count dependent rolls each: 80 rolls for 3 players, 100 for 4 players, 125 for 5 players, and 150 for 6 players) yielding a ranked heatmap of every vertex. Players complete a snake draft selection of initial settlements and roads with optimal direction advising.
3. **Active Gameplay (Phase 3)**: A full tracker containing an interactive Scoreboard, building placement actions (Roads, Settlements, Cities), Victory Points calculations, expected production yield tracking (cities count as 2x), piece building limits (5 settlements, 4 cities, 15 roads), Longest Road DFS-based card assignment, and session snapshot saving/loading.

**Live URL**: `https://[username].github.io/catan-board-advisor/`

### Key technologies

| Tool            | Version                       | Notes                                                        |
| --------------- | ----------------------------- | ------------------------------------------------------------ |
| Angular         | 21.2.x                        | **Zoneless** (no zone.js), Signals only                      |
| TypeScript      | 5.9.x                         | `strict: true`, `noUnusedLocals`, `noUnusedParameters`       |
| Tailwind CSS    | 4.x                           | PostCSS integration via `@tailwindcss/postcss`, no JS config |
| SCSS            | Sass                          | Component styles compiled natively by Angular builder        |
| Package manager | pnpm                          | Configured in `angular.json` `cli.packageManager`            |
| Testing         | Karma + Jasmine               | Default Angular test runner                                  |
| PWA             | @angular/service-worker       | ngsw-config.json + manifest.webmanifest                      |
| Deployment      | GitHub Actions → GitHub Pages | `peaceiris/actions-gh-pages@v4`                              |
| Linting         | ESLint 10+ (Flat Config)      | Configured in `eslint.config.js`                             |

### Critical architectural rules

1. **ALL components are `standalone: true`** — zero NgModules anywhere.
2. **State management: Angular Signals exclusively** — `signal()`, `computed()`, `effect()`. No RxJS for local state, no NgRx, no BehaviorSubject.
3. **No `any` type** — TypeScript strict mode throughout.
4. **pnpm only** — never npm. `angular.json` has `"packageManager": "pnpm"`.
5. **Modular Component Structure** — Component templates and stylesheets are split into dedicated `.component.html` and `.component.scss` files (except for extremely minimal templates like `AppComponent`'s router outlet) to maintain clean TypeScript files focused strictly on logic.

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
│   ├── styles.css                        # Tailwind v4 @import + CSS custom properties (global styles)
│   ├── manifest.webmanifest              # PWA manifest (standalone, portrait, amber theme)
│   ├── ngsw-config.json                  # Service worker precache config
│   │
│   ├── assets/icons/
│   │   ├── icon-192.png                  # PWA icon 192x192
│   │   └── icon-512.png                  # PWA icon 512x512
│   │
│   └── app/
│       ├── app.component.ts              # Root: just <router-outlet /> (inline minimal template)
│       ├── app.component.spec.ts         # Basic creation test
│       ├── app.config.ts                 # Providers: zoneless CD, hash routing, service worker
│       ├── app.routes.ts                 # ShellComponent + lazy board-advisor
│       │
│       ├── core/services/
│       │   ├── translation.service.ts    # Signal-based i18n (EN/ES), localStorage
│       │   ├── theme.service.ts          # Dark/light theme, prefers-color-scheme, localStorage
│       │   └── keyboard-shortcuts.service.ts # Global keydown handler, modal & shortcut dispatching
│       │
│       ├── shared/utils/
│       │   └── hex-math.utils.ts         # ALL hex grid geometry & spiral layout (see §3)
│       │
│       ├── shell/
│       │   ├── shell.component.ts        # App shell component
│       │   ├── shell.component.html      # App shell layout (header, settings toggles)
│       │   └── shell.component.scss      # App shell styling (min-height, layout limits)
│       │
│       └── features/board-advisor/
│           ├── board-advisor.routes.ts             # Lazy route → BoardAdvisorPageComponent
│           ├── board-advisor-page.component.ts     # Page compositor component
│           ├── board-advisor-page.component.html   # Main layout structure (two-column desktop)
│           ├── board-advisor-page.component.scss   # Layout limits & responsiveness styling
│           │
│           ├── models/
│           │   ├── hex.model.ts                    # HexLetter, HexDefinition
│           │   ├── vertex.model.ts                 # Vertex, ReachableVertex, BoardStateSnapshot
│           │   ├── dev-card.model.ts               # DevCardType, PlayedDevCard, deck configs
│           │   └── simulation-result.model.ts      # SimulationResult
│           │
│           ├── data/
│           │   ├── base-catan-board-layout.data.ts # Base board 5-row grid layout defaults (3-4 players)
│           │   ├── base-catan-letter-values.data.ts # Base board letter→number map (verified from physical game)
│           │   ├── ext-catan-board-layout.data.ts  # Extension board 7-row grid layout defaults (5-6 players)
│           │   └── ext-catan-letter-values.data.ts # Extension board letter→number map (verified from physical game)
│           │
│           ├── i18n/
│           │   ├── en.translations.ts              # Translations interface + EN constant
│           │   └── es.translations.ts              # ES constant (imports Translations from en)
│           │
│           ├── services/
│           │   ├── board-layout.service.ts          # Builds HexDefinition[] from layout data
│           │   ├── simulation.service.ts            # Monte Carlo simulation logic (see §6)
│           │   └── board-state.store.ts             # Central Signal-based store (see §4)
│           │
│           └── components/
│               ├── board/
│               │   ├── board.component.ts           # SVG board controller (drag-and-drop, text rotation) (see §5)
│               │   ├── board.component.html         # SVG template: hexes, vertices, and drag ghosts
│               │   └── board.component.scss         # Board styling (transitions, animations, custom states)
│               ├── vertex-detail-panel/
│               │   ├── vertex-detail-panel.component.ts # Vertex detail panel logic
│               │   └── vertex-detail-panel.component.html # Vertex detail layout (score, adjacent tiles, road options)
│               ├── board-controls/
│               │   ├── board-controls.component.ts  # Undo/redo/rotate bar controller
│               │   └── board-controls.component.html # Bar buttons layout
│               ├── hex-info-panel/
│               │   ├── hex-info-panel.component.ts  # Hex stats drawer logic
│               │   └── hex-info-panel.component.html # Hex information layout (times rolled, probability)
│               ├── player-setup/
│               │   ├── player-setup.component.ts    # Player count & color chips controller
│               │   ├── player-setup.component.html  # Chip grid & picker layout
│               │   └── player-setup.component.scss  # Setup container styles
│               ├── setup-ranking/
│               │   ├── setup-ranking.component.ts   # Phase 2 score rankings controller
│               │   ├── setup-ranking.component.html # Leaderboard ranking list layout
│               │   └── setup-ranking.component.scss # Ranking animation & custom cell styles
│               ├── turn-indicator/
│               │   ├── turn-indicator.component.ts  # Current turn indicator controller
│               │   ├── turn-indicator.component.html # Player color chip and turn counter layout
│               │   └── turn-indicator.component.scss # Indicator layout styling
│               ├── game-scoreboard/
│               │   ├── game-scoreboard.component.ts  # Game phase scoreboard and tool picker
│               │   ├── game-scoreboard.component.html # Scoreboard rows, VPs, and build action triggers
│               │   └── game-scoreboard.component.scss # Scoreboard specific visual styles
│               ├── dev-cards-panel/
│               │   ├── dev-cards-panel.component.ts  # Dev cards probability pie-chart and player tracker
│               │   ├── dev-cards-panel.component.html # Progress bars, legend, SVGs, per-player summaries
│               │   └── dev-cards-panel.component.scss # Component styles
│               └── shortcuts-help-modal/
│                   ├── shortcuts-help-modal.component.ts  # Keyboard shortcuts cheat sheet modal
│                   ├── shortcuts-help-modal.component.html # Keybinding list by category layout
│                   └── shortcuts-help-modal.component.scss # Backdrop & modal styles
```

### File purpose quick reference

| File                               | One-liner                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `hex-math.utils.ts`                | Pure functions: hex coordinates, vertices, deduplication, adjacency, viewBox, heatmap, spiral mapping         |
| `board-state.store.ts`             | Single source of truth: 15+ signals + 10+ computed. Phase-aware undo/redo stacks, custom names & snapshot v2. |
| `keyboard-shortcuts.service.ts`    | Global keyboard listener intercepting build actions, draft selection, undo/redo, and modal toggles.           |
| `simulation.service.ts`            | Stateless: runs 10000 mini-games (custom rolls depending on players), returns SimulationResult                |
| `board-layout.service.ts`          | Stateless: takes variant, desert positions + R, returns HexDefinition[]                                       |
| `board.component.*`                | SVG rendering: hexes, vertices, Pointer Events drag-and-drop, label upright rotation, scale                   |
| `vertex-detail-panel.component.*`  | Detail drawer showing vertex score, ranking, adjacent tiles, and settlement toggle                            |
| `shortcuts-help-modal.component.*` | Cheat sheet modal displaying available keyboard shortcuts grouped by category                                 |
| `dev-cards-panel.component.*`      | Detail drawer showing dev card probabilities, legend, and per-player hand estimated potential                 |
| `dev-card.model.ts`                | Types and configurations for full (34) and reduced (25) dev card decks                                        |
| `shell.component.*`                | App chrome: header (lang/theme/settings toggles) + settings drawer & shortcuts help trigger                   |

---

## 3. Hex Grid Math & Spiral Mapping (hex-math.utils.ts)

### Coordinate system

**Orientation**: Pointy-top hexagons (vertex at top and bottom, flat edges left/right). This matches the physical Catan board.

**Grid structures**:

- **Base Board**: 5 rows with sizes `[3, 4, 5, 4, 3]` (row 2 is the widest at 5 hexes, 19 total).
- **Extension Board**: 7 rows with sizes `[3, 4, 5, 6, 5, 4, 3]` (row 3 is the widest at 6 hexes, 30 total).

**Circumradius `R`**: Computed adaptively to fit the board based on the widest row of the active variant (5 hexes for base, 6 hexes for extension).

### Hex center computation

```
hexSpacingX = R * √3           // horizontal distance between hex centers in a row
rowSpacingY = R * 1.5           // vertical distance between row centers
startXForRow(r) = (widest_size - rowSizes[r]) * hexSpacingX / 2   // center-align against widest row

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

Deduplication maps vertices using Rounded coordinates to 1 decimal place: `"${Math.round(x*10)}-${Math.round(y*10)}"`

**Result**:

- **Base Board**: ~54 unique vertices.
- **Extension Board**: ~84 unique vertices.

---

## 4. Signal-Based State Flow (board-state.store.ts)

### Signal graph

```
                                     Base Board Variant / Ext Board Variant (Store Variant)
                                                               │
                                     ┌─────────────────────────▼──────────┐
                                     │  desertState()                     │ ← updateDesertPosition() / drag-and-drop
                                     │  hexSize()                         │ ← updateHexSize()
                                     └──────────────────┬─────────────────┘
                                                        │
                                     ┌──────────────────▼──────────┐
                                     │  hexes (computed)           │ ← BoardLayoutService.buildHexGrid()
                                     └──────────────────┬──────────┘
                                                        │
                               ┌────────────────────────┼───────────────────┐
                               │                        │                   │
                    ┌──────────▼──────────┐             │        ┌──────────▼──────────┐
                    │  allVertices        │             │        │  viewBox (computed) │
                    │  (computed)         │             │        └─────────────────────┘
                    │  dedup + adjacency  │             │
                    └──────────┬──────────┘             │
                               │                        │
                     ┌─────────▼─────────┐              │
                     │  startSimulation  ├──────────────┘  ← Manual trigger (Phase 1 → 2)
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

| Signal                      | Type                                       | Default                             | Persisted                        |
| --------------------------- | ------------------------------------------ | ----------------------------------- | -------------------------------- |
| `playerCount`               | `3 \| 4 \| 5 \| 6`                         | `3`                                 | No                               |
| `playerColors`              | `PlayerColor[]`                            | Red, Blue, Mustard (based on count) | No                               |
| `myPlayerColorId`           | `string \| null`                           | `null`                              | No                               |
| `desertState`               | `DesertState`                              | Base/Ext default desert positions   | No                               |
| `placedSettlements`         | `PlacedSettlement[]`                       | `[]`                                | No                               |
| `placedRoads`               | `PlacedRoad[]`                             | `[]`                                | No                               |
| `undoStack`                 | `ActionSnapshot[]`                         | `[]`                                | No (Phase 2 & 3 actions)         |
| `redoStack`                 | `ActionSnapshot[]`                         | `[]`                                | No (Phase 2 & 3 actions)         |
| `desertUndoStack`           | `DesertState[]`                            | `[]`                                | No (Phase 1 desert undo)         |
| `desertRedoStack`           | `DesertState[]`                            | `[]`                                | No (Phase 1 desert redo)         |
| `selectedVertexId`          | `string \| null`                           | `null`                              | No                               |
| `selectedHexId`             | `string \| null`                           | `null`                              | No                               |
| `boardRotationDeg`          | `0 \| 90 \| 180 \| 270`                    | `0`                                 | No                               |
| `isSimulating`              | `boolean`                                  | `false`                             | No                               |
| `hexSize`                   | `number`                                   | computed from viewport              | No                               |
| `appPhase`                  | `AppPhase` (`'setup'\|'results'\|'game'`)  | `'setup'`                           | No                               |
| `showNumbersInSetup`        | `boolean`                                  | `false`                             | No                               |
| `scoreFormat`               | `'decimal'\|'percentage'`                  | `'decimal'`                         | localStorage `catan-score-fmt`   |
| `showZeroScores`            | `boolean`                                  | `true`                              | localStorage `catan-show-zeros`  |
| `enableAutoZoom`            | `boolean`                                  | `true`                              | localStorage `catan-auto-zoom`   |
| `isSelectingRoad`           | `boolean`                                  | `false`                             | No (Phase 2 road options active) |
| `pendingSettlementVertexId` | `string \| null`                           | `null`                              | No                               |
| `currentRoadOptions`        | `RoadOption[]`                             | `[]`                                | No                               |
| `gameActivePlayerId`        | `string \| null`                           | `null`                              | No                               |
| `activeBuildTool`           | `'road' \| 'settlement' \| 'city' \| null` | `null`                              | No                               |
| `longestRoadOwnerId`        | `string \| null`                           | `null`                              | No                               |
| `panelVisible`              | `boolean`                                  | `true`                              | No                               |
| `currentTurnIndex`          | `number`                                   | `0`                                 | No                               |
| `_simulationResult`         | `SimulationResult \| null`                 | `null`                              | No (private)                     |
| `useReducedDeck`            | `boolean`                                  | `false`                             | Yes (in snapshot)                |
| `devCardsPurchased`         | `Record<string, number>`                   | `{}`                                | Yes (in snapshot)                |
| `devCardsPlayed`            | `PlayedDevCard[]`                          | `[]`                                | Yes (in snapshot)                |
| `largestArmyOwnerId`        | `string \| null`                           | `null`                              | Yes (in snapshot)                |
| `devCardsPanelOpen`         | `boolean`                                  | `false`                             | No                               |
| `projectionTargetPlayerId`  | `string`                                   | `'me'` (or `'none'`)                | Yes (in snapshot)                |
| `builderPickerVertexId`     | `string \| null`                           | `null`                              | No (transient overlay state)     |
| `builderPickerEdge`         | `{ from: string; to: string } \| null`     | `null`                              | No (transient overlay state)     |
| `builderPickerOptions`      | `BuilderOption[]`                          | `[]`                                | No (transient overlay state)     |

**Computed signals (derived):**

| Signal                   | Depends on                                                             | Purpose                                                                                         |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `boardVariant`           | `playerCount`                                                          | Returns `'base'` if playerCount <= 4, else `'ext'`                                              |
| `rollsPerGame`           | `playerCount`                                                          | Dynamically sets rolls per game (80 for 3, 100 for 4, 125 for 5, 150 for 6 players)             |
| `hexes`                  | `desertState`, `hexSize`, `boardVariant`                               | Build hex grid via BoardLayoutService                                                           |
| `spiralLetterAssignment` | `desertState`, `boardVariant`                                          | Maps row-col to current letter label based on spiral rules                                      |
| `allVertices`            | `hexes`, `hexSize`                                                     | Deduplicate + build adjacency graph                                                             |
| `settledVertexIds`       | `placedSettlements`                                                    | Maps placed settlements to string IDs                                                           |
| `scoredVertices`         | `allVertices`, `simulationResult`, `placedSettles`                     | Apply simulation scores + settlement/blocked state                                              |
| `rankedVertices`         | `scoredVertices`, `hexes`                                              | Re-ranks eligible vertices after settlements                                                    |
| `topVertex`              | `rankedVertices`                                                       | Vertex with rank === 1                                                                          |
| `viewBox`                | `hexes`, `hexSize`                                                     | SVG viewBox dimensions                                                                          |
| `simulationResult`       | `_simulationResult` (readonly view)                                    | Public API                                                                                      |
| `turnSequence`           | `playerColors`                                                         | Computes the snake draft order (e.g. $1 \to 2 \to 3 \to 4 \to 4 \to 3 \to 2 \to 1$)             |
| `currentPlayerColor`     | `appPhase`, `currentTurnIndex`, `activePlayerId`                       | Active player during placements draft or active game tracker                                    |
| `totalTurns`             | `playerCount`                                                          | Computes total turns in setup placement (playerCount * 2)                                       |
| `isSetupComplete`        | `currentTurnIndex`, `totalTurns`                                       | Returns true once draft has completed                                                           |
| `playerLongestRoads`     | `placedRoads`, `playerColors`, `placedSettlements`                     | Runs DFS per player, checking opponent settlement blocks                                        |
| `longestRoadLengths`     | `playerLongestRoads`                                                   | Extract path lengths per player                                                                 |
| `longestRoadDetails`     | `longestRoadOwnerId`, `playerLongestRoads`                             | Owner details and full road segment coordinates for glow overlay                                |
| `playerScores`           | `playerColors`, `placements`, `longestRoad`, `largestArmy`, `devCards` | Table of stats (settlements/cities/roads count, knights, hand size, VP, score, expected yield)  |
| `activeDeckConfig`       | `useReducedDeck`, `playerCount`                                        | Returns BASE_DECK or FULL_DECK based on selection and configuration                             |
| `totalPlayedByType`      | `devCardsPlayed`                                                       | Maps each DevCardType to total times played                                                     |
| `remainingByType`        | `activeDeckConfig`, `totalPlayedByType`                                | Subtracts played cards from deck size, guarded by Math.max(0, ...)                              |
| `remainingTotal`         | `remainingByType`                                                      | Total cards remaining unaccounted for in the game                                               |
| `drawProbabilities`      | `remainingByType`                                                      | Probability distribution of each card type among remaining unrevealed cards (in pile and hands) |
| `playerKnightsPlayed`    | `devCardsPlayed`                                                       | Maps playerColorId to knights played count                                                      |
| `playerVPCards`          | `devCardsPlayed`                                                       | Maps playerColorId to victory point cards revealed                                              |
| `playerDevCardsSummary`  | `devCardsPurchased`, `devCardsPlayed`                                  | Aggregated summary per player (inHand, played total, playedByType)                              |
| `gameWinner`             | `playerScores`, `appPhase`                                             | Evaluates if a player reaches >= 10 Victory Points                                              |
| `validSettlementSpots`   | `appPhase`, `activeBuildTool`, `scoredVertices`                        | Returns vertex IDs where active player can build settlements                                    |
| `validCitySpots`         | `appPhase`, `activeBuildTool`, `placedSettles`                         | Returns vertex IDs where active player can upgrade a settlement to city                         |
| `validRoadEdges`         | `appPhase`, `activeBuildTool`, `allVertices`                           | Valid edges `{ from, to, p1, p2 }` for active player to build roads                             |

### Snake Draft Placement Order

In Catan, the initial settlement setup follows a **snake draft** (e.g., for 4 players: $1 \to 2 \to 3 \to 4 \to 4 \to 3 \to 2 \to 1$).

- In Phase 2, `TurnIndicatorComponent` dynamically computes whose turn it is.
- It alerts the user when they must pick, color-coding the indicator, and tracks placements sequentially up to the final player's second settlement.
- Once placements are complete, the `SetupRankingComponent` displays a ranked leaderboard of all players based on the simulated yield of their placed settlements.

---

## 5. SVG Rendering, Drag-and-Drop & Mobile Touch Gestures (board.component.ts + html + scss)

### Interactive Desert Drag-and-Drop (Pointer Events API)

- **Base Board**: Has exactly 1 desert tile. Renders as a single draggable point.
- **Extension Board**: Has exactly 2 desert tiles (`L1` and `L2`). Renders as two independent points.
- Touch/mouse drag captures pointer events and renders a translucent ghost preview.
- Nearby hexes undergo a distance-based hit-test to find the closest drop target.
- In **Extension Board** mode, dropping a desert on the other desert's position is automatically blocked. Dropping it on an adjacent tile will swap their positions if necessary.

### Hold-to-Act Gestures & Rapid Building Mechanics

- **Hold-to-Act on Intersections & Edges**: Pressing and holding an intersection vertex or edge path for ~400ms - 1s triggers quick placement directly without needing to switch active build tools or navigate drawer panels.
  - In **Phase 2 (Setup/Draft)**: Rapidly places a settlement (or opens builder picker if multiple colors qualify).
  - In **Phase 3 (Active Game)**: Upgrades existing settlements to cities, places new settlements on empty connected spots, or builds connecting roads.
- **Directional Animated Progress Feedback**: Dual-converging animated SVG stroke indicators give visual progress feedback target-locked to the active press location.
- **Haptic Vibration Feedback**: Fires `navigator.vibrate(40)` upon hold completion on touch-supported mobile devices.

### Multi-Builder Floating Selection Menu (Builder Picker)

- When an intersection or road edge can be built upon by multiple eligible player colors (e.g. in setup or where multiple players' networks converge), a floating radial selection menu (`builderPickerOptions`) renders directly above the target coordinate.
- Selecting a color executes `confirmBuilderPickerSelection(colorId)`, performing the placement in a single tap while dismissing the overlay.

### Callout & Context Menu Protection

- Added CSS rules (`user-select: none`, `-webkit-touch-callout: none`, `-webkit-user-select: none`) and `@HostListener('contextmenu', ['$event'])` event handlers.
- Prevents native iOS/Android callout selection popups, long-press web context menus, and copy highlight overlays from disrupting interactive touch gestures.

### Visual Placements and Runway Indicators

- **Runway Indicators**: Hovering over valid road paths in the Active Game phase triggers flashing LED runway dot lights. Dots traverse the segment from source (connected road/settlement) to target, aiding gameplay visualization.
- **High-Contrast Dark Mode Mapping**: Dark player colors (e.g. blue, chocolate, or green) are mapped to vivid, bright neon equivalents in dark mode settings to ensure clear visibility against dark hexagon backgrounds.

---

## 6. The Simulation Engine (simulation.service.ts)

### Algorithm

```
INPUT:  hexes: HexDefinition[], vertices: Vertex[], rollsPerGame: number
OUTPUT: SimulationResult { totalMiniGames, rollCountMap, resourceMap, maxRawScore, rankedVertexIds }

1. Initialize lookup tables:
   - numberToHexIds: Map<diceNumber, hexId[]>
   - vertexAdjacentHexSet: Map<vertexId, Set<hexId>>
   - miniGameScores: Map<vertexId, number[]>

2. Loop 10000 times (TOTAL_MINI_GAMES):
   - Initialize gameResources Map: vertexId → 0
   - Loop rollsPerGame times (depending on player count: 3→80, 4→100, 5→125, 6→150):
     - Roll dice:
       - Generate randomValues Uint32Array using cryptographically secure Web Crypto API:
         crypto.getRandomValues(randomValues)
       - roll = (randomValues[i] % 6) + 1 + (randomValues[i+1] % 6) + 1
     - Skip if roll === 7 (robber)
     - Increment rollCountMap.get(roll)
     - For each vertex, check adjacent producing hexes for that roll
     - Add resource count (if any) to gameResources
   - Save resource rate (gameResources / rollsPerGame) to miniGameScores for each vertex

3. Calculate average resources-per-roll:
   - rawScore = average of all 10000 mini-game scores
   - totalResources = rawScore * rollsPerGame (representative resources per game)
   - normalizedScore = rawScore / maxRawScore (0-1 range)

4. Rank eligible vertices:
   - Filter: !blocked, !occupied, adjacent to at least one non-desert hex
   - Sort by rawScore descending
   - Assign rank 1, 2, 3...
```

### Performance & Integration

- **Render Yielding**: The execution of the Monte Carlo simulation is delayed by 100ms (`setTimeout(..., 100)`) to guarantee that the browser paints the "Simulating..." spinner overlay prior to blocking the single CPU thread.
- **Randomness Security**: Uses the cryptographically secure `crypto.getRandomValues()` API instead of standard `Math.random()` to eliminate linter warnings and prevent seed patterns.
- Runs in ~10-25ms.
- To prevent mutating source vertices during simulation, the store copies vertices before invoking the service.

---

## 7. Board Data (verified from physical game)

### Base Board Tokens (18 letters)

```
A:5  B:2  C:6  D:3  E:8  F:10 G:9  H:12 I:11 J:4
K:8  L:10 M:9  N:4  O:5  P:6  Q:11 R:3
Default desert position: (2,2) (center hex)
```

### Extension Board Tokens (28 letters)

```
A:2  B:5  C:4  D:6  E:3  F:9  G:8  H:11 I:11 J:10
K:6  L:3  M:8  N:4  O:8  P:10 Q:11 R:12 S:10 T:5
U:4  V:9  W:5  X:9  Y:12 Za:3 Zb:2 Zc:6
Default desert positions: L1 at (3,3), L2 at (4,2)
```

spiral paths start from the top-right outer ring and loop inwards counterclockwise.

---

## 8. Active Game Algorithms & Snapshots

### Expected Production Yield

The scoreboard tracks each player's expected resources per roll.

- Formula: $\sum (\text{adjacent vertex probability rate} \times \text{piece weight})$
- Settlements have a piece weight of $1\times$.
- Cities upgrade the vertex, increasing its piece weight to $2\times$.

### Longest Road DFS Algorithm

Calculated dynamically in `board-state.store.ts`:

- Traverses a player's road network using Depth-First Search (DFS) to locate the longest continuous cycle-free path.
- **Opponent Blockage**: Opponent settlements block paths. If a node is occupied by an opponent's settlement, DFS terminates that path.
- **Tie-Breaker Rules**:
  - Minimum path length of $5$ is required to qualify.
  - If a player holds the card and their road length is matched by another player, the card is retained by the current owner.
  - If there is no card owner, a player must be the _unique_ leader to claim it.
  - If the current owner is surpassed but there is a tie for first place, the card returns to the bank.

### Largest Army Award Algorithm

Calculated dynamically in `board-state.store.ts`:

- Evaluates the total number of Knight cards played by each player.
- **Tie-Breaker & Majority Rules**:
  - Minimum of $3$ Knights played is required to qualify.
  - If a player holds the card, another player must strictly _exceed_ (not match) their count to claim it.
  - If the owner is surpassed, but there is a tie for first place among challengers, the card returns to the bank.

### Win Condition Freeze & Safety Checks

- `gameWinner()` signal evaluates whether any player reaches $\ge 10$ Victory Points.
- All placement, building, edge action methods (`buildSettlement`, `placeSettlement`, `upgradeToCity`, `buildRoad`), and valid spot computeds (`validSettlementSpots`, `validCitySpots`, `validRoadEdges`) check `gameWinner()`.
- Action execution and interactive highlights freeze instantly when a player reaches the victory condition, ensuring state integrity after a win.

### Snapshot Import/Export Sequence (Version 2)

A JSON snapshot saves the entire setup/game state. The serialization format is version-controlled (`version: 2`).
Snapshot `v2` preserves full `undoStack` and `redoStack` action states, custom player names, projection target preferences (`projectionTargetPlayerId`), and history logs across sessions.
To prevent state race conditions, importation follows a strict signal-setting order:

1. `playerCount` (triggers computed `boardVariant` to calculate dimensions).
2. `playerColors` and custom player names (`setPlayerName`).
3. `hexSize` (adaptive sizing calculated after `boardVariant` stabilizes).
4. `desertState` (recomputes hex grid coordinates and vertices).
5. Action lists & stacks: `placedSettlements`, `placedRoads`, `currentTurnIndex`, `boardRotationDeg`, `undoStack`, and `redoStack`.
6. `simulationResult` (re-attaches simulation numbers so vertices can resolve expected yields).
7. Game active states: `gameActivePlayerId`, `longestRoadOwnerId`, `largestArmyOwnerId`, and `projectionTargetPlayerId`.
8. Development card configs and logs: `useReducedDeck`, `devCardsPurchased`, and `devCardsPlayed`.
9. `appPhase` (set LAST to trigger a full UI layout update).

---

## 9. Keyboard Shortcuts Engine (keyboard-shortcuts.service.ts)

The application provides a global keyboard shortcuts system powered by `KeyboardShortcutsService` provided in `root`.

### Features & Context Handling

- **Context Isolation**: Direct key events are ignored when focus is inside text input fields (`HTMLInputElement`, `HTMLTextAreaElement`, or `isContentEditable`), except for specialized input navigation (e.g. `Enter` / `Tab` in custom player name fields).
- **Cheat Sheet Modal (`ShortcutsHelpModalComponent`)**: Pressing `?` or `h` toggles the interactive cheat sheet modal listing all keybindings by category with full i18n support.
- **Backdrop & Escape Controls**: Pressing `Escape` closes active drawers and modals (Help Cheat Sheet, Dev Cards Panel, Hex Info Panel, Vertex Detail Panel, Zoomed Chart), closes open builder pickers (`builderPickerOptions`), and deselects selected hexes (`selectedHexId`) and vertices (`selectedVertexId`).

### Keybindings Quick Reference

| Key / Combination        | Action / Target Context                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `?` or `h`               | Open / Close Keyboard Shortcuts Cheat Sheet Modal                                            |
| `s`                      | Activate **Settlement** tool (Active Game Phase 3)                                           |
| `c`                      | Activate **City** tool (Active Game Phase 3)                                                 |
| `r`                      | Activate **Road** tool (Active Game Phase 3)                                                 |
| `d`                      | Toggle **Development Cards** Panel (Active Game Phase 3)                                     |
| `1` .. `9`               | Select rank option (1st to 9th) during Snake Draft Placement (Phase 2)                       |
| `Ctrl+Z` / `Cmd+Z`       | Undo last action (Phase 1 desert move, Phase 2 draft, Phase 3 build)                         |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo action                                                                                  |
| `Ctrl+O`                 | Trigger Load Snapshot file dialog                                                            |
| `Ctrl+S`                 | Export current session state snapshot `.json`                                                |
| `Escape`                 | Dismiss modals/pickers & deselect active hex (`selectedHexId`) / vertex (`selectedVertexId`) |

---

## 10. Build & Development Commands

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

# Format files
pnpm run format
```
