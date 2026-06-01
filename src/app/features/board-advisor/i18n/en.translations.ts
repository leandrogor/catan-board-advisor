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
  resourcesPerRoll: string;
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
  scoreFormat: string;
  decimal: string;
  percentage: string;
  showZeroScores: string;
  close: string;
  rowLabel: string;
  colLabel: string;
  desert: string;
  noDataYet: string;
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
  resourcesPerRoll: 'resources/roll',
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
  scoreFormat: 'Score format',
  decimal: 'Decimal',
  percentage: 'Percentage',
  showZeroScores: 'Show zero-score vertices',
  close: 'Close',
  rowLabel: 'Row',
  colLabel: 'Col',
  desert: 'Desert',
  noDataYet: 'No data yet',
};
