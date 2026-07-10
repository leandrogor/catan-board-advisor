import { Component, inject, computed, signal } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PlayerColor } from '../../models/player-color.model';

export interface ScoreboardRow {
  color: PlayerColor;
  settlementsCount: number;
  citiesCount: number;
  roadsCount: number;
  score: number;
  avgProd: number;
  longestRoadLength: number;
  hasLongestRoad: boolean;
}

@Component({
  selector: 'app-game-scoreboard',
  templateUrl: './game-scoreboard.component.html',
  styleUrl: './game-scoreboard.component.scss',
})
export class GameScoreboardComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly buildPickerOpen = signal<boolean>(false);

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
    const t = this.i18n.t();
    const map: Record<PlayerColor['id'], string> = {
      red: t.colorRed,
      blue: t.colorBlue,
      mustard: t.colorMustard,
      cream: t.colorCream,
      green: t.colorGreen,
      chocolate: t.colorChocolate,
    };
    return map[color.id] ?? color.id;
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

  protected onBuildButtonClick(colorId: string, event: Event): void {
    event.stopPropagation();
    if (this.store.gameWinner()) return;

    if (this.store.gameActivePlayerId() === colorId) {
      this.buildPickerOpen.update(v => !v);
    } else {
      this.store.selectActivePlayerInGame(colorId);
      this.buildPickerOpen.set(true);
    }
  }

  protected selectTool(tool: 'road' | 'settlement' | 'city' | null, event: Event): void {
    event.stopPropagation();
    this.store.activeBuildTool.set(tool);
    this.buildPickerOpen.set(false);
  }
}
