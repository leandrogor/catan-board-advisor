export interface ShortcutConfig {
  startSimulation: string;
  loadSnapshot: string;
  saveSnapshot: string;
  settings: string;
  darkMode: string;
  rotateBoard: string;
  focusFirstName: string;
  selectMe: string;
  devCards: string;
  stats: string;
  toggleProductionFormat: string;
  toggleSetupNumbers: string;
}

export interface Translations {
  shortcuts: ShortcutConfig;
  appTitle: string;
  appSubtitleBase: string;
  appSubtitleExt: string;
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
  setupHintBase: string;
  setupHintExt: string;
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
  resetConfirmMessage: string;
  // Player setup
  playerCount: string;
  boardGroupBase: string;
  boardGroupExt: string;
  colorOrder: string;
  isMeLabel: string;
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
  // Game mode keys
  continueGame: string;
  scoreboardTitle: string;
  victoryPoints: string;
  settlementsCount: string;
  citiesCount: string;
  roadsCount: string;
  winnerBadge: string;
  longestRoadBadge: string;
  noRoadConnection: string;
  limitSettlements: string;
  limitCities: string;
  limitRoads: string;
  upgradeToCity: string;
  buildSettlement: string;
  buildRoad: string;
  pointsLabel: string;
  occupiedByOpponent: (colorName: string) => string;
  totalExpectedProd: string;
  city: string;
  settlement: string;
  editNameHint: string;
  // Snapshot
  saveSnapshot: string;
  loadSnapshot: string;
  // Development Cards
  devCardsTitle: string;
  devCardsPurchase: string;
  devCardsPlay: string;
  devCardKnight: string;
  devCardVictoryPoint: string;
  devCardMonopoly: string;
  devCardRoadBuilding: string;
  devCardYearOfPlenty: string;
  largestArmyBadge: string;
  devCardsRemaining: string;
  devCardsPlayed: string;
  devCardsProbability: string;
  devCardsInHand: string;
  devCardsKnightsPlayed: string;
  devCardsDeckType: string;
  devCardsDeckFull: string;
  devCardsDeckBase: string;
  devCardsDeckHint: string;
  devCardsNoCards: string;
  devCardsEstimatedPotential: string;
  devCardsBuildHint: string;
  devCardsDeckCardsLeft: (remaining: number, total: number) => string;
  devCardsPieLabelLine1: string;
  devCardsPieLabelLine2: string;
  statsTitle: string;
  statsTabProgress: string;
  statsTabProjection: string;
  statsVPTrend: string;
  statsProdTrend: string;
  statsRoundsToWin: string;
  statsRoundsWon: string;
  statsNoData: string;
  statsLogTitle: string;
  statsEngineSpeed: string;
  statsEngineFast: string;
  statsEngineMedium: string;
  statsEngineSlow: string;
  statsProjectionsHint: string;
  statsProdPower: string;
  statsMoveNum: string;
  statsAwardLongestRoadGained: string;
  statsAwardLongestRoadLost: string;
  statsAwardLargestArmyGained: string;
  statsAwardLargestArmyLost: string;
  statsInitialPhase: string;
  statsStartLabel: string;
  statsGenericAction: string;
  statsViewFull: string;
  statsZoomMode: string;
  statsRoundsRange: (lower: number, upper: number) => string;
  statsLogSettlementsAdded: (count: number) => string;
  statsLogCitiesAdded: (count: number) => string;
  statsLogRoadsAdded: (count: number) => string;
  statsLogDevCardsBought: (count: number) => string;
  statsLogDevCardsPlayed: (count: number, cardNamesStr: string) => string;
  statsLogSettlementsRemoved: (count: number) => string;
  statsLogCitiesRemoved: (count: number) => string;
  statsLogRoadsRemoved: (count: number) => string;
}

export const EN: Translations = {
  shortcuts: {
    startSimulation: 's',
    loadSnapshot: 'l',
    saveSnapshot: 's',
    settings: 'a',
    darkMode: 'd',
    rotateBoard: 'r',
    focusFirstName: 'n',
    selectMe: 'm',
    devCards: 'c',
    stats: 'g',
    toggleProductionFormat: 'p',
    toggleSetupNumbers: 'v',
  },
  appTitle: 'Catan Board Advisor',
  appSubtitleBase: 'Base Game',
  appSubtitleExt: '5-6 Player Extension',
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
  setupHintBase: 'Drag the desert tile 🏜️ to reposition it, then start the simulation.',
  setupHintExt: 'Drag the desert tiles 🏜️ to reposition them, then start the simulation.',
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
  resetConfirmMessage:
    'Are you sure you want to reset the board? All simulation results will be lost.',
  // Player setup
  playerCount: 'Players',
  boardGroupBase: 'Base',
  boardGroupExt: 'Extension',
  colorOrder: 'Turn Order',
  isMeLabel: 'Me',
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
  // Game mode keys
  continueGame: 'Continue Game',
  scoreboardTitle: 'Game Scoreboard',
  victoryPoints: 'Victory Points',
  settlementsCount: 'Settlements',
  citiesCount: 'Cities',
  roadsCount: 'Roads',
  winnerBadge: 'Winner!',
  longestRoadBadge: 'Longest Road',
  noRoadConnection: 'Must connect to one of your roads',
  limitSettlements: 'Limit of 5 settlements reached. Upgrade to city to build more.',
  limitCities: 'Limit of 4 cities reached.',
  limitRoads: 'Limit of 15 roads reached.',
  upgradeToCity: 'Upgrade to City',
  buildSettlement: 'Build Settlement',
  buildRoad: 'Build Road',
  pointsLabel: 'pts',
  occupiedByOpponent: (colorName: string): string => `Occupied by ${colorName}`,
  totalExpectedProd: 'Total expected resources per roll',
  city: 'City',
  settlement: 'Settlement',
  editNameHint: 'Click to edit player name',
  // Snapshot
  saveSnapshot: '💾 Save Snapshot',
  loadSnapshot: '📂 Load Snapshot',
  // Development Cards
  devCardsTitle: 'Development Cards',
  devCardsPurchase: 'Buy Dev Card',
  devCardsPlay: 'Play Card:',
  devCardKnight: 'Knight',
  devCardVictoryPoint: 'Victory Point',
  devCardMonopoly: 'Monopoly',
  devCardRoadBuilding: 'Road Building',
  devCardYearOfPlenty: 'Year of Plenty',
  largestArmyBadge: 'Largest Army',
  devCardsRemaining: 'Remaining',
  devCardsPlayed: 'Played',
  devCardsProbability: 'Draw Probability',
  devCardsInHand: 'Cards in hand',
  devCardsKnightsPlayed: 'Knights played',
  devCardsDeckType: 'Development Deck',
  devCardsDeckFull: 'Full Deck (34 cards)',
  devCardsDeckBase: 'Base Deck (25 cards)',
  devCardsDeckHint: 'Use the reduced 25-card base deck for 3-4 player games.',
  devCardsNoCards: 'No cards in hand',
  devCardsEstimatedPotential: 'Estimated potential',
  devCardsBuildHint: 'Use 🔨 to buy or play development cards',
  devCardsDeckCardsLeft: (remaining: number, total: number): string =>
    `${remaining}/${total} cards remaining`,
  devCardsPieLabelLine1: 'if you draw',
  devCardsPieLabelLine2: 'a card',
  statsTitle: 'Game Statistics',
  statsTabProgress: 'Progression',
  statsTabProjection: 'Projections',
  statsVPTrend: 'Victory Points Progression',
  statsProdTrend: 'Production Engine Growth',
  statsRoundsToWin: 'Est. Rounds to Win',
  statsRoundsWon: 'Won! 🏆',
  statsNoData: 'No buildings placed in the active game yet. Build something to see stats!',
  statsLogTitle: 'Game Log',
  statsEngineSpeed: 'Engine Speed',
  statsEngineFast: 'Fast ⚡',
  statsEngineMedium: 'Moderate ⚖️',
  statsEngineSlow: 'Slow 🐌',
  statsProjectionsHint:
    'Projections estimate how many full rounds of table turns (1 roll per player) are needed to reach 10 VP based on current production rates.',
  statsProdPower: 'Current Production Power',
  statsMoveNum: 'Move',
  statsAwardLongestRoadGained: '+Longest Road',
  statsAwardLongestRoadLost: '-Longest Road',
  statsAwardLargestArmyGained: '+Largest Army',
  statsAwardLargestArmyLost: '-Largest Army',
  statsInitialPhase: 'Initial Phase',
  statsStartLabel: 'Start',
  statsGenericAction: 'Action',
  statsViewFull: 'View Full',
  statsZoomMode: 'Zoom Mode',
  statsRoundsRange: (lower: number, upper: number): string => `${lower} - ${upper} rounds`,
  statsLogSettlementsAdded: (count: number): string => `${count} settlement${count > 1 ? 's' : ''}`,
  statsLogCitiesAdded: (count: number): string => `${count} cit${count > 1 ? 'ies' : 'y'}`,
  statsLogRoadsAdded: (count: number): string => `${count} road${count > 1 ? 's' : ''}`,
  statsLogDevCardsBought: (count: number): string => `${count} card${count > 1 ? 's' : ''} bought`,
  statsLogDevCardsPlayed: (count: number, cardNamesStr: string): string =>
    `${count} card${count > 1 ? 's' : ''} played${cardNamesStr}`,
  statsLogSettlementsRemoved: (count: number): string =>
    `${count} settlement${Math.abs(count) > 1 ? 's' : ''}`,
  statsLogCitiesRemoved: (count: number): string =>
    `${count} cit${Math.abs(count) > 1 ? 'ies' : 'y'}`,
  statsLogRoadsRemoved: (count: number): string => `${count} road${Math.abs(count) > 1 ? 's' : ''}`,
};
