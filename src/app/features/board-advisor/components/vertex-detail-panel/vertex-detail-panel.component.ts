import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { HexDefinition } from '../../models/hex.model';

@Component({
  selector: 'app-vertex-detail-panel',
  templateUrl: './vertex-detail-panel.component.html',
})
export class VertexDetailPanelComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly selectedVertex = computed(() => {
    const id = this.store.selectedVertexId();
    if (!id) return null;
    return this.store.rankedVertices().find(v => v.id === id) ?? null;
  });

  protected readonly settlementAtVertex = computed(() => {
    const vertex = this.selectedVertex();
    if (!vertex) return null;
    return this.store.getSettlementAt(vertex.id) ?? null;
  });

  protected readonly playerPieceCounts = computed(() => {
    const activeId = this.store.currentPlayerColor()?.id;
    if (!activeId) return { settlements: 0, cities: 0, roads: 0 };
    return this.store.getPlayerPieceCounts(activeId);
  });

  protected readonly canBuildSettlement = computed(() => {
    const vertex = this.selectedVertex();
    const activeId = this.store.currentPlayerColor()?.id;
    if (!vertex || !activeId) return false;
    if (vertex.isOccupied || vertex.isBlocked) return false;
    if (this.playerPieceCounts().settlements >= 5) return false;
    if (this.store.appPhase() === 'game' && !this.store.hasRoadConnected(vertex.id, activeId)) {
      return false;
    }
    return true;
  });

  protected readonly canUpgradeToCity = computed(() => {
    if (this.store.gameWinner()) return false;
    const settlement = this.settlementAtVertex();
    if (!settlement || settlement.type === 'city') return false;
    const ownerId = settlement.playerColorId;
    const counts = this.store.getPlayerPieceCounts(ownerId);
    if (counts.cities >= 4) return false;
    return true;
  });

  protected readonly availableBuilderColors = computed<
    { colorId: string; colorHex: string; name: string }[]
  >(() => {
    if (this.store.gameWinner()) return [];
    const vertex = this.selectedVertex();
    if (!vertex || vertex.isOccupied || vertex.isBlocked) return [];

    if (!this.store.isSetupComplete()) {
      const active = this.store.currentPlayerColor();
      if (!active) return [];
      return [
        {
          colorId: active.id,
          colorHex: active.hex,
          name: this.getOwnerName(active.id),
        },
      ];
    }

    const result: { colorId: string; colorHex: string; name: string }[] = [];
    for (const p of this.store.playerColors()) {
      if (this.store.hasRoadConnected(vertex.id, p.id)) {
        const counts = this.store.getPlayerPieceCounts(p.id);
        if (counts.settlements < 5) {
          result.push({
            colorId: p.id,
            colorHex: p.hex,
            name: this.getOwnerName(p.id),
          });
        }
      }
    }
    return result;
  });

  protected readonly availableRoadDirections = computed<
    { toVertexId: string; builderName: string; builderColorHex: string; builderColorId: string }[]
  >(() => {
    if (this.store.gameWinner()) return [];
    const vertex = this.selectedVertex();
    if (!vertex) return [];

    const result: {
      toVertexId: string;
      builderName: string;
      builderColorHex: string;
      builderColorId: string;
    }[] = [];

    for (const adjId of vertex.adjacentVertexIds) {
      const builders = this.store.getAvailableRoadBuildersForEdge(vertex.id, adjId);
      for (const b of builders) {
        result.push({
          toVertexId: adjId,
          builderName: b.name,
          builderColorHex: b.colorHex,
          builderColorId: b.colorId,
        });
      }
    }
    return result;
  });

  protected readonly roadOptions = computed(() => {
    const vertex = this.selectedVertex();
    if (!vertex) return [];
    return this.store.computeRoadOptionsForVertex(vertex.id);
  });

  protected onBuildRoadDirectionClick(fromId: string, toId: string, builderColorId?: string): void {
    this.store.buildRoad(fromId, toId, builderColorId);
  }

  protected readonly adjacentHexes = computed<HexDefinition[]>(() => {
    const vertex = this.selectedVertex();
    if (!vertex) return [];
    const hexes = this.store.hexes();
    return vertex.adjacentHexIds
      .map(hid => hexes.find(h => h.id === hid))
      .filter((h): h is HexDefinition => h !== undefined);
  });

  protected readonly adjacentNumbers = computed(
    () =>
      this.adjacentHexes()
        .filter(h => !h.isDesert && h.diceNumber !== null)
        .map(h => h.diceNumber)
        .join(' · ') || '—',
  );

  protected readonly adjacentLetters = computed(
    () =>
      this.adjacentHexes()
        .map(h => {
          const posKey = `${h.row}-${h.col}`;
          return this.store.spiralLetterAssignment().get(posKey) ?? h.letter;
        })
        .join(' · ') || '—',
  );

  protected readonly formattedScore = computed(() => {
    const vertex = this.selectedVertex();
    if (!vertex) return '—';
    const fmt = this.store.scoreFormat();
    if (fmt === 'percentage') {
      return `${(vertex.rawScore * 100).toFixed(1)}% ${this.i18n.t().avgResourcesPerRoll}`;
    }
    return `${vertex.rawScore.toFixed(3)} ${this.i18n.t().avgResourcesPerRoll}`;
  });

  protected formatValue(score: number): string {
    const fmt = this.store.scoreFormat();
    if (fmt === 'percentage') {
      return `${(score * 100).toFixed(1)}%`;
    }
    return score.toFixed(3);
  }

  protected getOwnerName(colorId?: string): string {
    if (!colorId) return '';
    return this.store.getPlayerName(colorId);
  }

  protected onUpgradeToCityClick(vertexId: string): void {
    this.store.upgradeToCity(vertexId);
  }

  protected onBuildSettlementClick(vertexId: string, playerColorId?: string): void {
    if (this.store.appPhase() === 'game') {
      this.store.buildSettlement(vertexId, playerColorId);
    } else if (!this.store.isSetupComplete()) {
      this.store.startSelectingRoad(vertexId);
    } else {
      this.store.placeSettlement(vertexId, playerColorId);
    }
  }
}
