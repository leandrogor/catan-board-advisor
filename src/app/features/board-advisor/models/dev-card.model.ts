/** The 5 types of development cards in Catan. */
export type DevCardType = 'knight' | 'victoryPoint' | 'monopoly' | 'roadBuilding' | 'yearOfPlenty';

/** Deck composition for a given game configuration. */
export interface DevCardDeckConfig {
  knight: number;
  victoryPoint: number;
  monopoly: number;
  roadBuilding: number;
  yearOfPlenty: number;
  total: number;
}

/**
 * Full deck (Base + Extension): 34 cards total.
 * Default for all games regardless of player count.
 */
export const FULL_DECK: DevCardDeckConfig = {
  knight: 20,
  victoryPoint: 5,
  monopoly: 3,
  roadBuilding: 3,
  yearOfPlenty: 3,
  total: 34,
};

/**
 * Reduced base-game-only deck: 25 cards total.
 * Optional for 3-4 player games.
 */
export const BASE_DECK: DevCardDeckConfig = {
  knight: 14,
  victoryPoint: 5,
  monopoly: 2,
  roadBuilding: 2,
  yearOfPlenty: 2,
  total: 25,
};

/** All dev card types in display order. */
export const DEV_CARD_TYPES: DevCardType[] = [
  'knight',
  'victoryPoint',
  'monopoly',
  'roadBuilding',
  'yearOfPlenty',
];

/** Record of a card that was played/revealed by a player. */
export interface PlayedDevCard {
  type: DevCardType;
  playerColorId: string;
}
