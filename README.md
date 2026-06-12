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
- **Pointer-Events Drag-and-Drop**: Drag deserts (`L1` and `L2` in extension, or the single desert in base) directly on the board. Token numbers and letters dynamically recalculate their spiral paths counterclockwise.
- **Monte Carlo Simulation Engine**: Computes $10000$ mini-games of player-count dependent rolls each (80 rolls for 3 players, 100 for 4 players, 125 for 5 players, and 150 for 6 players) in under $20\text{ms}$ to yield raw resource probabilities per vertex.
- **Vertex Heatmap & Ranking**: Visualizes optimal intersections using HSL-based heatmaps, highlighting the best spot with pulsing rings, and displaying top ranking slots directly on the board.
- **Snake Draft Placement Order**: Simulates the standard setup order (e.g. $1 \to 2 \to 3 \to 4 \to 4 \to 3 \to 2 \to 1$). It tracks whose turn it is, alerts you when to pick, and ranks placements on a final leaderboard once complete.
- **Road Expansion Planner**: Evaluates and suggests the best expansion roads based on projected target settlement scores and distance cost (evaluated in unified transactions with undo/redo support).
- **Phase-Aware Undo/Redo**: Distinct undo/redo transactions for Phase 1 (desert configuration) and Phase 2 (settlement placements & road selection).
- **Settings Control Center**: Toggle between decimal rates and percentage rates, hide/show zero-probability scores, and enable auto-zoom behavior on active selections.
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
