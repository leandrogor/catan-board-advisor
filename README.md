# 🎲 Catan Board Advisor

[![Deploy to GitHub Pages](https://github.com/leandrogor/catan-board-advisor/actions/workflows/deploy.yml/badge.svg)](https://github.com/leandrogor/catan-board-advisor/actions/workflows/deploy.yml)
[![Angular](https://img.shields.io/badge/Angular-21.2-DD0031.svg?logo=angular)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220.svg?logo=pnpm)](https://pnpm.io/)

A premium, modern **Zoneless Angular 21** Progressive Web App (PWA) designed to advise Catan players on finding optimal initial settlement placements.

It supports both the **Base Board (3-4 Players)** and the **5-6 Player Extension** board variants, dynamically adjusting grid geometries, letters, and desert positions based on the selected player setup.

---

## 🌟 Key Features

- **Dynamic Board Layouts**:
  - **3-4 Players**: Standard Base Board layout (19 hexes, 1 desert, letters A to R).
  - **5-6 Players**: Extension Board layout (30 hexes, 2 deserts, letters A to Zc).
- **Pointer-Events Drag-and-Drop**: Drag deserts (`L1` and `L2` in extension, or the single desert in base) directly on the board. Token numbers and letters dynamically recalculate their spiral paths counter-clockwise.
- **Hold-to-Act Gestures & Mobile Quick Actions**:
  - Touch & hold (~400ms - 1s) on board vertices and edges to build settlements, upgrade to cities, or place roads instantly without tool switching.
  - **Directional Animated Hold Progress**: Dual-converging animated SVG stroke indicators give visual feedback during hold gestures, paired with haptic vibration (`navigator.vibrate`).
  - **2-Finger Swipe Undo/Redo & Gesture Counter**: Swipe left (`←`) with 2 fingers on the board to undo an action (`store.undo()`) and swipe right (`→`) to redo (`store.redo()`), featuring a consecutive gesture counter badge (`x2`, `x3`, etc.), auto-extending toast notification timeouts, and haptic vibration.
  - **Mobile Touch-Action & Road Selection Isolation**: Optimizes pinch-to-zoom touch actions, disables vertex/hex pointer events during road selection mode (`isSelectingRoad`) to eliminate selection misclicks, and stabilizes SVG badges against hover flicker.
  - **Multi-Builder Radial Selection Menu**: Interactive floating builder picker overlay when multiple player colors connect to an intersection or edge.
  - **Native Callout Protection**: Prevents native context menus, text selection popups (`user-select: none`, `-webkit-touch-callout: none`), and long-press browser defaults during gesture interaction.
- **Monte Carlo Simulation Engine**: Computes $10000$ mini-games of player-count dependent rolls each (80 rolls for 3 players, 100 for 4 players, 125 for 5 players, and 150 for 6 players) in under $25\text{ms}$ (with a 100ms yield to guarantee UI render updates) to yield raw expected resource probabilities per vertex.
- **Vertex Heatmap & Ranking**: Visualizes optimal intersections using HSL-based heatmaps, highlighting the best spot with pulsing rings, displaying top ranking slots directly on the board, and assigning the last production rank to non-producing vertices instead of `null` for complete leaderboard coverage.
- **Vertex Yield Inspection & Distance-Rule Hiding**: Inspect expected yield on all board intersections while automatically hiding/dimming vertices blocked by Catan's 2-edge distance rule. Option to toggle zero-score vertex markers via settings drawer.
- **Click-Outside Modal Dismissal**: Detail panels (Hex Info Panel, Vertex Detail Panel) feature full-viewport transparent backdrops (`fixed inset-0 z-40 bg-transparent`), allowing seamless modal dismissal by tapping anywhere outside the active panel.
- **Phase-Conditioned Settings Drawer**: Options inside the app shell settings drawer automatically adjust to match the active game phase (Phase 1 Setup, Phase 2 Draft, Phase 3 Active Game).
- **Snake Draft Placement Order**: Simulates the standard setup order (e.g. $1 \to 2 \to 3 \to 4 \to 4 \to 3 \to 2 \to 1$). It tracks whose turn it is, alerts you when to pick, and ranks placements on a final leaderboard once complete.
- **Keyboard Shortcuts & Help Cheat Sheet Modal**:
  - Global keyboard shortcuts for fast gameplay: `?` / `h` (Cheat Sheet Modal), `s` (Settlement), `c` (City), `r` (Road), `d` (Dev Cards), `1`..`9` (Rank selection in draft), `Ctrl+Z` / `Ctrl+Y` (Undo/Redo), and `ESC` (Modal dismiss, builder picker close, hex & vertex deselect).
- **Custom Player Names**:
  - Set custom player names during setup or active game scoreboard. Names populate across board tooltips, rankings, turn indicators, and dev card summaries, and are saved in snapshots.
- **Road Expansion Planner & Customizable Projections**:
  - Evaluates and suggests the best expansion roads based on projected target settlement scores and distance cost (evaluated in unified transactions with undo/redo support).
  - Features customizable projection target player selector (`projectionTargetPlayerId`), secondary option styling, and opponent settlement expansion safety logic.
- **Active Game Mode (Phase 3) & Win Condition Protection**:
  - Transition from board setup straight into live gameplay.
  - Scoreboard tracking settlements, cities, roads, total Victory Points (VP), and expected production rates.
  - Custom build tools (Settlements, Cities, Roads) with interactive placement highlights and piece limit enforcement (5 settlements, 4 cities, 15 roads).
  - Expected resource production stat reflecting current building counts (settlement = 1x, city = 2x expected resources per roll).
  - Dynamic game-ending announcement at 10 VP with custom winning color styling, freezing interactive build actions when a game winner is decided.
- **Longest Road Award**:
  - DFS-based path analyzer tracking the longest continuous road network for each player.
  - Accounts for blocking rules where opponent settlements cut road connectivity.
  - Grants +2 Victory Points to the lead player with a network of at least 5 roads, obeying standard Catan tie-breaker rules.
- **Development Cards Tracking & Estimated Potential**:
  - Track purchased (in-hand) and played development cards per player (Knight, Victory Point, Monopoly, Road Building, Year of Plenty).
  - Enforces deck capacities dynamically (34-card full deck by default, or 25-card base deck option). Enforces strict limits, preventing players from playing or buying cards exceeding deck totals.
  - Interactive probability donut chart and legend visualizing the chance of holding or drawing each card type based on remaining unrevealed cards (maintains per-player hand potential even when draw pile is exhausted).
- **Largest Army Award**:
  - Awards +2 Victory Points to the first player to play 3 Knights, following standard Catan majority transfer and tie-breaker rules.
  - Synchronizes badge pulse animation with the Longest Road badge in the scoreboard for a unified visual effect.
- **Snapshot Import/Export V2**:
  - Save your active game state by exporting a `.json` snapshot file (v2 format).
  - Restores complete undo/redo action stacks (`undoStack`/`redoStack`), history logs, custom player names, and board configurations.
- **Phase-Aware Undo/Redo**: Full undo/redo transaction support for Phase 1 (desert configuration), Phase 2 (settlement placements & road selection), and Phase 3 (active gameplay actions).
- **Expanded Chart Zoom & Viewport-Relative Tooltips**:
  - Interactive, viewport-aware tooltips with hover and pinning support across statistics charts.
  - Expanded chart zoom modal featuring translated titles, theme support, keyboard navigation, and backdrop dismiss.
- **Warm Parchment Theme & Visual Polish**:
  - Warm parchment light mode theme (`#faf8f3`), subtle neon piece glows in Dark Mode, glassmorphism overlays, and transparent backdrop controls.
- **Unified Modal Dialog Architecture**:
  - Consistent accessible in-app dialogs (`ConfirmDialogComponent`) for previous session recovery, board reset confirmation, and PWA updates with keyboard (<kbd>Escape</kbd>) and backdrop dismiss support.
- **Strict TypeScript Architecture**: 100% strictly typed codebase with zero `unknown` types, dedicated snapshot models (`BoardSnapshot`), and comprehensive type guards for all state and configuration handlers.
- **Dark Mode & Multilingual**: Sleek dark/light modes and fully signal-based Spanish/English i18n support.
- **Progressive Web App (PWA)**: Works offline, can be installed on home screens, and launches instantly.

---

## 🛠️ Technical Stack & Architecture

- **Framework**: Zoneless Angular 21 (Zero Zone.js dependency, resulting in improved change detection performance).
- **State Management**: Writable and Computed **Angular Signals** exclusively (Single store architecture).
- **Services**: `KeyboardShortcutsService` for global event handling, `TranslationService` for signal i18n, `ThemeService` for light/dark mode.
- **Styles**: SCSS + Tailwind CSS v4 (using `@tailwindcss/postcss`).
- **Scaffolding**: Highly modularized architecture. Split components into separate `.component.html` and `.component.scss` files for optimal maintainability.
- **Testing**: Unit tests powered by Karma and Jasmine.

---

## 🚀 Getting Started

### Prerequisites

- Node.js version 22 or higher.
- `pnpm` package manager installed globally.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/leandrogor/catan-board-advisor.git
   cd catan-board-advisor
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm start
   ```
   Navigate to `http://localhost:4200/`. The application will automatically reload if you change any source files.

---

## 📖 Available Commands

- `pnpm start`: Run the Angular development server on port 4200.
- `pnpm run build`: Compile the production application bundle into `dist/catan-board-advisor/`.
- `pnpm run lint`: Run ESLint to verify typescript styles and static rules.
- `pnpm run format`: Prettify all source files (HTML, SCSS, TS, JSON) with Prettier.
- `pnpm test`: Execute unit tests via Karma.

---

## 🛸 CI/CD & Deployment

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the app to GitHub Pages upon pushing to the `main` branch.

To trigger a manual build for GitHub Pages:

```bash
pnpm ng build --base-href /catan-board-advisor/ --configuration production
```

The output will be compiled into `dist/catan-board-advisor/browser/`.
