export interface Translations {
  appTitle: string;
  appSubtitle: string;
  simulating: string;
  desert1Label: string;
  desert2Label: string;
  placeSettlement: string;
  removeSettlement: string;
  undo: string;
  redo: string;
  rank: string;
  score: string;
  avgResourcesPerRoll: string;
  adjacentNumbers: string;
  adjacentLetters: string;
  bestPosition: string;
  blocked: string;
  blockedDescription: string;
  occupied: string;
  lightMode: string;
  darkMode: string;
  language: string;
  settings: string;
  rotateBoard: string;
  settlementsPlaced: (count: number) => string;
  hexLetter: string;
  hexNumber: string;
  hexRolled: string;
  hexProbability: string;
  scoreFormat: string;
  decimal: string;
  percentage: string;
  showZeroScores: string;
  autoZoom: string;
  close: string;
  rowLabel: string;
  colLabel: string;
  desert: string;
  noDataYet: string;
  startSimulation: string;
  resetToSetup: string;
  setupTitle: string;
  setupHint: string;
  dragToMove: string;
  setupToggleHint: string;
  roadOptions: string;
  rank1Best: string;
  rank2: string;
  rank3: string;
  direct: string;
  projected: string;
  cancel: string;
  selectRoadDirection: string;
  updateAvailable: string;
  showPanel: string;
  hidePanel: string;
  // Player setup
  playerCount: string;
  colorOrder: string;
  colorRed: string;
  colorBlue: string;
  colorMustard: string;
  colorCream: string;
  colorGreen: string;
  colorChocolate: string;
  // Turn indicator
  turnIndicator: (turn: number, total: number, colorName: string) => string;
  // Ranking
  rankingTitle: string;
  rankingProdRank: string;
  rankingTurnOrder: string;
  rankingScore: string;
}

export const EN: Translations = {
  appTitle: 'Catan Board Advisor',
  appSubtitle: '5-6 Player Extension',
  simulating: 'Simulating...',
  desert1Label: 'Desert 1',
  desert2Label: 'Desert 2',
  placeSettlement: 'Place Settlement',
  removeSettlement: 'Remove Settlement',
  undo: 'Undo',
  redo: 'Redo',
  rank: 'Rank',
  score: 'Score',
  avgResourcesPerRoll: 'Avg resources/roll',
  adjacentNumbers: 'Adjacent numbers',
  adjacentLetters: 'Adjacent letters',
  bestPosition: 'Best Position',
  blocked: 'Blocked',
  blockedDescription: 'Adjacent to a settlement',
  occupied: 'Occupied',
  lightMode: 'Light mode',
  darkMode: 'Dark mode',
  language: 'Language',
  settings: 'Settings',
  rotateBoard: 'Rotate board',
  settlementsPlaced: (count: number): string =>
    `${count} settlement${count === 1 ? '' : 's'} placed`,
  hexLetter: 'Letter',
  hexNumber: 'Number',
  hexRolled: 'Avg. times rolled per game',
  hexProbability: 'Probability',
  scoreFormat: 'Score format',
  decimal: 'Decimal',
  percentage: 'Percentage',
  showZeroScores: 'Show zero-score vertices',
  autoZoom: 'Auto-zoom on selection',
  close: 'Close',
  rowLabel: 'Row',
  colLabel: 'Col',
  desert: 'Desert',
  noDataYet: 'No data yet',
  startSimulation: '▶ Start Simulation',
  resetToSetup: '↺ Reset Board',
  setupTitle: 'Board Setup',
  setupHint: 'Drag the desert tiles 🏜️ to reposition them, then start the simulation.',
  dragToMove: 'Drag to move',
  setupToggleHint: '💡 Tap any hex to toggle all between letters and numbers.',
  roadOptions: 'Road Options',
  rank1Best: 'Rank 1 (Best)',
  rank2: 'Rank 2',
  rank3: 'Rank 3',
  direct: 'Direct',
  projected: 'Projected',
  cancel: 'Cancel',
  selectRoadDirection: 'Select Road Direction',
  updateAvailable: 'A new version of the app is available. Do you want to update now?',
  showPanel: 'Show Panel',
  hidePanel: 'Hide Panel',
  // Player setup
  playerCount: 'Players',
  colorOrder: 'Turn Order',
  colorRed: 'Red',
  colorBlue: 'Blue',
  colorMustard: 'Mustard',
  colorCream: 'Cream',
  colorGreen: 'Green',
  colorChocolate: 'Chocolate',
  // Turn indicator
  turnIndicator: (turn: number, total: number, colorName: string): string =>
    `Turn ${turn}/${total} — ${colorName}`,
  // Ranking
  rankingTitle: 'Final Rankings',
  rankingProdRank: 'Rank',
  rankingTurnOrder: 'Turn',
  rankingScore: 'Score',
};
