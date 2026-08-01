import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PlayerColor } from '../../models/player-color.model';
import { DevCardType } from '../../models/dev-card.model';

export interface ScoreboardRow {
  color: PlayerColor;
  settlementsCount: number;
  citiesCount: number;
  roadsCount: number;
  score: number;
  avgProd: number;
  longestRoadLength: number;
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  vpCards: number;
  knightsPlayed: number;
  devCardsInHand: number;
}

@Component({
  selector: 'app-game-scoreboard',
  templateUrl: './game-scoreboard.component.html',
  styleUrl: './game-scoreboard.component.scss',
})
export class GameScoreboardComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected get activePickerPlayerId() {
    return this.store.buildPickerPlayerId;
  }
  protected readonly buildPickerOpen = computed(() => this.store.buildPickerPlayerId() !== null);
  protected get showPlayCardMenu() {
    return this.store.showPlayCardMenu;
  }

  protected readonly DEV_CARD_TYPES: {
    type: DevCardType;
    emoji: string;
    labelKey: keyof ReturnType<TranslationService['t']>;
  }[] = [
    { type: 'knight', emoji: '⚔️', labelKey: 'devCardKnight' },
    { type: 'victoryPoint', emoji: '🏆', labelKey: 'devCardVictoryPoint' },
    { type: 'monopoly', emoji: '🔄', labelKey: 'devCardMonopoly' },
    { type: 'roadBuilding', emoji: '🛤️', labelKey: 'devCardRoadBuilding' },
    { type: 'yearOfPlenty', emoji: '💡', labelKey: 'devCardYearOfPlenty' },
  ];

  protected readonly scoreboardRows = computed(() => {
    const rows = [...this.store.playerScores()];
    return rows.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.avgProd - a.avgProd;
    });
  });

  protected colorName(color: PlayerColor): string {
    return this.store.getPlayerName(color.id);
  }

  protected onNameInput(colorId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.setPlayerName(colorId, input.value);
  }

  protected getTurnOrder(colorId: string): number {
    return this.store.playerColors().findIndex(c => c.id === colorId) + 1;
  }

  protected formatProduction(val: number): string {
    if (this.store.scoreFormat() === 'percentage') {
      return `${(val * 100).toFixed(1)}%`;
    }
    return val.toFixed(3);
  }

  protected getActiveToolEmoji(): string {
    const tool = this.store.activeBuildTool();
    switch (tool) {
      case 'road':
        return '🛣️';
      case 'settlement':
        return '🏠';
      case 'city':
        return '🏰';
      default:
        return '🔨';
    }
  }

  protected canBuildRoad(row: ScoreboardRow): boolean {
    return row.roadsCount < 15;
  }

  protected canBuildSettlement(row: ScoreboardRow): boolean {
    if (row.settlementsCount >= 5) return false;
    const vertices = this.store.scoredVertices();
    return vertices.some(
      v => !v.isOccupied && !v.isBlocked && this.store.hasRoadConnected(v.id, row.color.id),
    );
  }

  protected canUpgradeToCity(row: ScoreboardRow): boolean {
    return row.citiesCount < 4 && row.settlementsCount > 0;
  }

  protected canPurchaseDevCard(): boolean {
    return (
      this.store.remainingTotal() -
        Object.values(this.store.devCardsPurchased()).reduce((s, n) => s + n, 0) >
      0
    );
  }

  protected canPlayDevCard(row: ScoreboardRow): boolean {
    return row.devCardsInHand > 0;
  }

  protected isCardTypeAvailable(type: DevCardType): boolean {
    const deck = this.store.activeDeckConfig();
    const played = this.store.totalPlayedByType();
    return played[type] < deck[type];
  }

  protected onBuildButtonClick(colorId: string, event: Event): void {
    event.stopPropagation();
    if (this.store.gameWinner()) return;

    if (this.activePickerPlayerId() === colorId && this.buildPickerOpen()) {
      this.store.closePlayerBuildMenu();
    } else {
      this.store.openPlayerBuildMenu(colorId);
    }
  }

  protected selectTool(tool: 'road' | 'settlement' | 'city' | null, event: Event): void {
    event.stopPropagation();
    this.store.activeBuildTool.set(tool);
    this.store.closePlayerBuildMenu();
  }

  protected onPurchaseDevCard(colorId: string, event: Event): void {
    event.stopPropagation();
    this.store.purchaseDevCard(colorId);
    this.store.closePlayerBuildMenu();
  }

  protected onPlayDevCard(colorId: string, type: DevCardType, event: Event): void {
    event.stopPropagation();
    this.store.playDevCard(colorId, type);
    this.store.closePlayerBuildMenu();
  }

  protected togglePlayCardMenu(event: Event): void {
    event.stopPropagation();
    this.store.togglePlayCardMenu();
  }

  protected openDevCardsPanel(event: Event): void {
    event.stopPropagation();
    this.store.devCardsPanelOpen.set(true);
  }

  protected openStatsPanel(event: Event): void {
    event.stopPropagation();
    this.store.gameStatsPanelOpen.set(true);
  }

  protected getDevCardLabel(type: DevCardType): string {
    const t = this.i18n.t();
    const map: Record<DevCardType, string> = {
      knight: t.devCardKnight,
      victoryPoint: t.devCardVictoryPoint,
      monopoly: t.devCardMonopoly,
      roadBuilding: t.devCardRoadBuilding,
      yearOfPlenty: t.devCardYearOfPlenty,
    };
    return map[type];
  }
}
