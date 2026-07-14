import { PlacedSettlement, PlacedRoad } from './road-option.model';
import { PlayedDevCard } from './dev-card.model';

export type GameActionType =
  | 'start'
  | 'roll'
  | 'build_settlement'
  | 'upgrade_city'
  | 'build_road'
  | 'buy_dev_card'
  | 'play_dev_card'
  | 'remove_settlement';

export interface GameHistoryEntry {
  entryId: string; // Unique ID
  playerColorId: string; // Color of the player who made the move (empty for start)
  description: string; // Auto-generated description (e.g., "+1 poblado, +1 camino")
  scores: Record<string, number>; // Scoreboard VPs for all players at this point
  avgProd: Record<string, number>; // Expected resources per roll for all players at this point
  placements: PlacedSettlement[]; // All placed settlements/cities on the board at this point
  roads: PlacedRoad[]; // All placed roads on the board at this point
  devCardsPurchased: Record<string, number>; // Player ID -> cards in hand
  devCardsPlayed: PlayedDevCard[]; // All played cards at this point
  longestRoadOwnerId?: string | null;
  largestArmyOwnerId?: string | null;
  timestamp: number;
}
