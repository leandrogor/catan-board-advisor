import { AppPhase, BoardRotationDeg, PlayerCount } from '../services/board-state.store';
import { DesertState } from '../data/ext-catan-board-layout.data';
import { PlayerColor } from './player-color.model';
import { ActionSnapshot, PlacedRoad, PlacedSettlement } from './road-option.model';
import { PlayedDevCard } from './dev-card.model';
import { GameHistoryEntry } from './game-history.model';
import { GameTimerState } from './game-timer.model';

export interface RawSimulationResultSnapshot {
  totalMiniGames?: number;
  rollCountMap?: [number, number][];
  resourceMap?: [string, number][];
  maxRawScore?: number;
  rankedVertexIds?: string[];
}

export interface BoardSnapshot {
  version?: number;
  playerCount?: PlayerCount;
  playerColors?: PlayerColor[];
  myPlayerColorId?: string | null;
  projectionTargetPlayerId?: string;
  playerNames?: Record<string, string>;
  desertState?: DesertState;
  placedSettlements?: PlacedSettlement[];
  placedRoads?: PlacedRoad[];
  undoStack?: ActionSnapshot[];
  redoStack?: ActionSnapshot[];
  desertUndoStack?: DesertState[];
  desertRedoStack?: DesertState[];
  currentTurnIndex?: number;
  boardRotationDeg?: BoardRotationDeg;
  appPhase?: AppPhase;
  gameActivePlayerId?: string | null;
  longestRoadOwnerId?: string | null;
  largestArmyOwnerId?: string | null;
  useReducedDeck?: boolean;
  devCardsPurchased?: Record<string, number>;
  devCardsPlayed?: PlayedDevCard[];
  gameHistory?: GameHistoryEntry[];
  simulationResult?: RawSimulationResultSnapshot | null;
  /** Serialized timer state for cross-session continuity. */
  timerState?: GameTimerState | null;
}
