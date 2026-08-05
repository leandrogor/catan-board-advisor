import { Component, inject, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { DevCardType, DEV_CARD_TYPES } from '../../models/dev-card.model';
import { PlayerColor } from '../../models/player-color.model';

interface CardTypeDisplay {
  type: DevCardType;
  emoji: string;
  color: string; // tailwind bg color for pie slice
  hexColor: string; // actual hex for SVG
}

export interface QuickActionCardDef {
  type: DevCardType;
  emoji: string;
  shortName: string;
}

@Component({
  selector: 'app-dev-cards-panel',
  templateUrl: './dev-cards-panel.component.html',
  styleUrl: './dev-cards-panel.component.scss',
  imports: [DecimalPipe],
})
export class DevCardsPanelComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  constructor() {
    effect(() => {
      if (this.store.devCardsPanelOpen()) {
        this.store.devCardsPanelTab.set('actions');
      }
    });
  }

  protected get activeTab() {
    return this.store.devCardsPanelTab;
  }

  protected readonly ACTION_CARDS = computed(() => {
    const t = this.i18n.t();
    return [
      { type: 'knight' as DevCardType, emoji: '⚔️', label: t.devCardKnight },
      { type: 'roadBuilding' as DevCardType, emoji: '🛤️', label: t.devCardRoadBuilding },
      { type: 'yearOfPlenty' as DevCardType, emoji: '💡', label: t.devCardYearOfPlenty },
      { type: 'monopoly' as DevCardType, emoji: '🔄', label: t.devCardMonopoly },
      { type: 'victoryPoint' as DevCardType, emoji: '🏆', label: t.devCardVictoryPoint },
    ];
  });

  protected readonly CARD_TYPES: CardTypeDisplay[] = [
    { type: 'knight', emoji: '⚔️', color: 'bg-rose-500', hexColor: '#ef4444' },
    { type: 'roadBuilding', emoji: '🛤️', color: 'bg-emerald-500', hexColor: '#10b981' },
    { type: 'yearOfPlenty', emoji: '💡', color: 'bg-violet-500', hexColor: '#8b5cf6' },
    { type: 'monopoly', emoji: '🔄', color: 'bg-blue-500', hexColor: '#3b82f6' },
    { type: 'victoryPoint', emoji: '🏆', color: 'bg-amber-500', hexColor: '#f59e0b' },
  ];

  protected readonly deckTotal = computed(() => this.store.activeDeckConfig().total);

  protected readonly totalPlayedCount = computed(() => this.store.devCardsPlayed().length);

  protected readonly totalInHand = computed(() =>
    Object.values(this.store.devCardsPurchased()).reduce((s, n) => s + n, 0),
  );

  protected readonly cardsInPile = computed(() => this.store.remainingTotal() - this.totalInHand());

  /** Pie chart slices calculated from remaining proportions. */
  protected readonly pieSlices = computed(() => {
    const remaining = this.store.remainingByType();
    const total = this.store.remainingTotal();
    if (total === 0) return [];

    const circumference = 2 * Math.PI * 42; // r=42 for SVG circle
    let offset = 0;

    return this.CARD_TYPES.map(card => {
      const count = remaining[card.type];
      const fraction = count / total;
      const dashLen = fraction * circumference;
      const slice = {
        ...card,
        count,
        fraction,
        dashLen,
        dashOffset: -offset,
        percentage: fraction * 100,
      };
      offset += dashLen;
      return slice;
    });
  });

  /** Per-player dev card summary from store. */
  protected readonly playerSummary = computed(() => this.store.playerDevCardsSummary());

  protected colorName(color: PlayerColor): string {
    return this.store.getPlayerName(color.id);
  }

  protected getCardLabel(type: DevCardType): string {
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

  protected getDrawProbability(type: DevCardType): number {
    return this.store.drawProbabilities()[type] ?? 0;
  }

  protected getRemainingCount(type: DevCardType): number {
    return this.store.remainingByType()[type] ?? 0;
  }

  protected getTotalForType(type: DevCardType): number {
    return this.store.activeDeckConfig()[type];
  }

  protected getPlayedCount(type: DevCardType): number {
    return this.store.totalPlayedByType()[type] ?? 0;
  }

  protected readonly circumference = 2 * Math.PI * 42;

  protected close(): void {
    this.store.devCardsPanelOpen.set(false);
  }

  protected onPurchase(colorId: string): void {
    this.store.purchaseDevCard(colorId);
  }

  protected onPlay(colorId: string, type: DevCardType): void {
    this.store.playDevCard(colorId, type);
  }

  protected canPurchase(): boolean {
    return this.cardsInPile() > 0;
  }

  protected canPlay(colorId: string, type: DevCardType): boolean {
    const inHand = this.store.devCardsPurchased()[colorId] ?? 0;
    if (inHand <= 0) return false;
    const played = this.store.totalPlayedByType()[type] ?? 0;
    const deckMax = this.store.activeDeckConfig()[type] ?? 0;
    return played < deckMax;
  }

  protected getInHandCount(colorId: string): number {
    return this.store.devCardsPurchased()[colorId] ?? 0;
  }

  /** Expose DEV_CARD_TYPES for template iteration. */
  protected readonly devCardTypes: DevCardType[] = DEV_CARD_TYPES;
}
