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
- **Monte Carlo Simulation Engine**: Computes $10000$ mini-games of player-count dependent rolls each (80 rolls for 3 players, 100 for 4 players, 125 for 5 players, and 150 for 6 players) in under $25\text{ms}$ (with a 100ms yield to guarantee UI render updates) to yield raw expected resource probabilities per vertex.
- **Vertex Heatmap & Ranking**: Visualizes optimal intersections using HSL-based heatmaps, highlighting the best spot with pulsing rings, and displaying top ranking slots directly on the board.
- **Snake Draft Placement Order**: Simulates the standard setup order (e.g. $1 \to 2 \to 3 \to 4 \to 4 \to 3 \to 2 \to 1$). It tracks whose turn it is, alerts you when to pick, and ranks placements on a final leaderboard once complete.
- **Road Expansion Planner**: Evaluates and suggests the best expansion roads based on projected target settlement scores and distance cost (evaluated in unified transactions with undo/redo support).
- **Active Game Mode (Phase 3)**:
  - Transition from board setup straight into live gameplay.
  - Scoreboard tracking settlements, cities, roads, total Victory Points (VP), and expected production rates.
  - Custom build tools (Settlements, Cities, Roads) with interactive placement highlights and piece limit enforcement (5 settlements, 4 cities, 15 roads).
  - Expected resource production stat reflecting current building counts (settlement = 1x, city = 2x expected resources per roll).
  - Dynamic game-ending announcement at 10 VP with custom winning color styling.
- **Longest Road Award**:
  - DFS-based path analyzer tracking the longest continuous road network for each player.
  - Accounts for blocking rules where opponent settlements cut road connectivity.
  - Grants +2 Victory Points to the lead player with a network of at least 5 roads, obeying standard Catan tie-breaker rules.
- **Snapshot Import/Export**:
  - Save your active game state by exporting a `.json` snapshot file.
  - Load snapshots instantly to resume configuration or gameplay sessions on any device.
- **Phase-Aware Undo/Redo**: Full undo/redo transaction support for Phase 1 (desert configuration), Phase 2 (settlement placements & road selection), and Phase 3 (active gameplay actions).
- **Settings Control Center**: Toggle between decimal rates and percentage rates, hide/show zero-probability scores, and enable auto-zoom behavior on active selections.
- **Visual runway indicators & Neon High Contrast**:
  - Animated glowing LED-style runway lights highlighting valid road building directions in the current player's color.
  - Tailored color palette mappings matching dark player colors (like blue or chocolate) to bright neon versions in Dark Mode for perfect SVG contrast.
- **Dark Mode & Multilingual**: Sleek dark/light modes and fully signal-based Spanish/English i18n support.
- **Progressive Web App (PWA)**: Works offline, can be installed on home screens, and launches instantly.

---

## 🛠️ Technical Stack & Architecture

- **Framework**: Zoneless Angular 21 (Zero Zone.js dependency, resulting in improved change detection performance).
- **State Management**: Writable and Computed **Angular Signals** exclusively (Single store architecture).
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
