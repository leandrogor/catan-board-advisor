import { Injectable, inject, signal } from '@angular/core';
import { BoardStateStore } from '../../features/board-advisor/services/board-state.store';
import { TranslationService } from './translation.service';
import { ThemeService } from './theme.service';
import { DevCardType } from '../../features/board-advisor/models/dev-card.model';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly store = inject(BoardStateStore);
  private readonly i18n = inject(TranslationService);
  private readonly theme = inject(ThemeService);

  readonly settingsOpen = signal(false);
  readonly helpModalOpen = signal(false);

  /** Observable stream emitted when keyboard shortcut requests loading a snapshot. */
  readonly loadSnapshotRequested$ = new Subject<void>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', event => this.handleKeyDown(event));
    }
  }

  toggleSettings(): void {
    this.settingsOpen.update(open => !open);
  }

  toggleHelpModal(): void {
    this.helpModalOpen.update(open => !open);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isInputTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable === true;

    // ── 1. Input Field Specific Shortcuts (Player Name Inputs) ─────────
    if (isInputTarget) {
      if (target instanceof HTMLInputElement && target.id.startsWith('player-name-input-')) {
        this.handlePlayerNameInputKeyDown(event, target);
      }
      return;
    }

    const key = event.key.toLowerCase();
    const ctrlOrCmd = event.ctrlKey || event.metaKey;
    const shortcuts = this.i18n.t().shortcuts;

    // ── 2. Zoomed Chart Modal Shortcuts (Escape, Tab, Enter / Space) ─────────
    if (this.store.zoomedChart() !== null) {
      if (key === 'escape') {
        event.preventDefault();
        this.store.zoomedChart.set(null);
        return;
      }
      if (key === 'tab') {
        event.preventDefault();
        this.store.zoomedChart.update(type => (type === 'vp' ? 'prod' : 'vp'));
        return;
      }
      if (key === 'enter' || key === ' ' || key === 'spacebar') {
        event.preventDefault();
        this.store.toggleChartZoomMode();
        return;
      }
      return;
    }

    // ── 3. Builder Picker Active Shortcuts (Escape or 1, 2, 3...) ─────────
    if (this.store.builderPickerOptions().length > 0) {
      if (key === 'escape') {
        event.preventDefault();
        this.store.closeBuilderPicker();
        return;
      }
      if (!ctrlOrCmd && ['1', '2', '3', '4', '5', '6'].includes(key)) {
        const idx = Number(key) - 1;
        const options = this.store.builderPickerOptions();
        if (options[idx]) {
          event.preventDefault();
          this.store.confirmBuilderPickerSelection(options[idx].colorId);
          return;
        }
      }
    }

    // ── 4. Escape Key Hierarchy ─────────────────────────────────────────
    if (key === 'escape') {
      if (this.helpModalOpen()) {
        event.preventDefault();
        this.helpModalOpen.set(false);
        return;
      }
      if (this.store.devCardsPanelOpen()) {
        event.preventDefault();
        this.store.devCardsPanelOpen.set(false);
        return;
      }
      if (this.store.gameStatsPanelOpen()) {
        event.preventDefault();
        this.store.gameStatsPanelOpen.set(false);
        return;
      }
      if (this.store.showPlayCardMenu()) {
        event.preventDefault();
        this.store.showPlayCardMenu.set(false);
        return;
      }
      if (this.store.buildPickerPlayerId()) {
        event.preventDefault();
        this.store.closePlayerBuildMenu();
        return;
      }
      if (this.store.activeBuildTool()) {
        event.preventDefault();
        this.store.activeBuildTool.set(null);
        return;
      }
      if (this.store.isSelectingRoad()) {
        event.preventDefault();
        this.store.cancelRoadSelection();
        return;
      }
      if (this.store.selectedVertexId()) {
        event.preventDefault();
        this.store.selectVertex(null);
        return;
      }
      if (this.store.selectedHexId()) {
        event.preventDefault();
        this.store.selectHex(null);
        return;
      }
      if (this.settingsOpen()) {
        event.preventDefault();
        this.settingsOpen.set(false);
        return;
      }
    }

    // Block all other shortcuts if a modal drawer is currently open
    if (this.store.devCardsPanelOpen() || this.store.gameStatsPanelOpen()) {
      return;
    }

    // ── 3. Global Undo & Redo (Ctrl+Z / Ctrl+Y) ───────────────────────
    if (ctrlOrCmd && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.store.redo();
      } else {
        this.store.undo();
      }
      return;
    }

    if (ctrlOrCmd && key === 'y') {
      event.preventDefault();
      this.store.redo();
      return;
    }

    // ── 4. General App Shortcuts ───────────────────────────────────────

    // Rotate Board (R)
    if (!ctrlOrCmd && key === shortcuts.rotateBoard.toLowerCase()) {
      event.preventDefault();
      this.store.rotateBoard();
      return;
    }

    // Dark Mode Toggle (D)
    if (!ctrlOrCmd && key === shortcuts.darkMode.toLowerCase()) {
      event.preventDefault();
      this.theme.toggle();
      return;
    }

    // Toggle Dev Cards Panel (C in ES & EN)
    if (!ctrlOrCmd && key === shortcuts.devCards.toLowerCase()) {
      if (this.store.appPhase() === 'game') {
        event.preventDefault();
        this.store.devCardsPanelOpen.update(open => !open);
        return;
      }
    }

    // Toggle Game Stats Panel (E in ES, G in EN)
    if (!ctrlOrCmd && key === shortcuts.stats.toLowerCase()) {
      if (this.store.appPhase() === 'game') {
        event.preventDefault();
        this.store.gameStatsPanelOpen.update(open => !open);
        return;
      }
    }

    // Production Score Format Toggle (P)
    if (!ctrlOrCmd && key === shortcuts.toggleProductionFormat.toLowerCase()) {
      event.preventDefault();
      this.store.toggleScoreFormat();
      return;
    }

    // Shortcuts Help Modal Toggle (? or H)
    if (!ctrlOrCmd && (key === '?' || key === 'h' || key === shortcuts.help.toLowerCase())) {
      event.preventDefault();
      this.toggleHelpModal();
      return;
    }

    const isLoadKey = key === shortcuts.loadSnapshot.toLowerCase();

    // Player Setup Phase Actions
    if (this.store.appPhase() === 'setup') {
      // Toggle Numbers vs. Letters in Setup (V)
      if (!ctrlOrCmd && key === shortcuts.toggleSetupNumbers.toLowerCase()) {
        event.preventDefault();
        this.store.showNumbersInSetup.update(v => !v);
        return;
      }

      // Set player count (3, 4, 5, 6)
      if (!ctrlOrCmd && ['3', '4', '5', '6'].includes(key)) {
        event.preventDefault();
        this.store.setPlayerCount(Number(key) as 3 | 4 | 5 | 6);
        return;
      }

      // Focus 1st player name field (N)
      if (!ctrlOrCmd && key === shortcuts.focusFirstName.toLowerCase()) {
        event.preventDefault();
        const firstInput = document.getElementById(
          'player-name-input-0',
        ) as HTMLInputElement | null;
        firstInput?.focus();
        firstInput?.select();
        return;
      }

      // Start Simulation (S in EN / I in ES)
      if (
        !ctrlOrCmd &&
        key === shortcuts.startSimulation.toLowerCase() &&
        !this.store.isSimulating()
      ) {
        event.preventDefault();
        this.store.startSimulation();
        return;
      }

      // Load Snapshot (L in EN / C in ES)
      if (!ctrlOrCmd && isLoadKey) {
        event.preventDefault();
        this.loadSnapshotRequested$.next();
        return;
      }
    }

    // Save Snapshot (S in EN / G in ES) in Results/Game Phase
    if (
      this.store.appPhase() !== 'setup' &&
      !ctrlOrCmd &&
      key === shortcuts.saveSnapshot.toLowerCase()
    ) {
      event.preventDefault();
      this.store.exportSnapshot();
      return;
    }

    // Toggle Settings (A in ES / A or S in EN)
    if (!ctrlOrCmd && (key === shortcuts.settings.toLowerCase() || key === 'a')) {
      event.preventDefault();
      this.toggleSettings();
      return;
    }

    // ── 5. Phase 2 Setup Placement & Road Selection Shortcuts ─────────
    if (this.store.appPhase() === 'results' && !this.store.isSetupComplete()) {
      // Road Selection Active: 1, 2, 3 choose road option, Enter / Space selects option #1
      if (this.store.isSelectingRoad()) {
        if (!ctrlOrCmd && ['1', '2', '3'].includes(key)) {
          const roadIdx = Number(key) - 1;
          const options = this.store.currentRoadOptions();
          if (options[roadIdx]) {
            event.preventDefault();
            this.store.confirmRoadSelection(options[roadIdx].toVertexId);
          }
          return;
        }

        if (key === 'enter' || key === ' ' || key === 'spacebar') {
          const options = this.store.currentRoadOptions();
          if (options[0]) {
            event.preventDefault();
            this.store.confirmRoadSelection(options[0].toVertexId);
          }
          return;
        }
      }

      // Number keys 1-9 select/cycle ranked vertices
      if (!ctrlOrCmd && key >= '1' && key <= '9') {
        const targetRank = Number(key);
        const rankedVertices = this.store.rankedVertices();
        let rankMatches = rankedVertices.filter(v => v.rank === targetRank);

        if (rankMatches.length === 0) {
          const lowerRanks = rankedVertices
            .map(v => v.rank)
            .filter((r): r is number => r !== null && r < targetRank);
          if (lowerRanks.length > 0) {
            const fallbackRank = Math.max(...lowerRanks);
            rankMatches = rankedVertices.filter(v => v.rank === fallbackRank);
          }
        }

        if (rankMatches.length > 0) {
          event.preventDefault();
          const currentSelectedId = this.store.selectedVertexId();
          const currentMatchIdx = rankMatches.findIndex(v => v.id === currentSelectedId);

          if (currentMatchIdx !== -1) {
            // Cycle to next tied vertex with this rank
            const nextIdx = (currentMatchIdx + 1) % rankMatches.length;
            this.store.selectVertex(rankMatches[nextIdx].id);
          } else {
            // Select first vertex of this rank
            this.store.selectVertex(rankMatches[0].id);
          }
          return;
        }
      }

      // Enter or Space key in placement phase (when not selecting road yet)
      if (key === 'enter' || key === ' ' || key === 'spacebar') {
        if (!this.store.isSelectingRoad() && this.store.selectedVertexId()) {
          event.preventDefault();
          this.store.startSelectingRoad(this.store.selectedVertexId()!);
          return;
        }
      }
    }

    // ── 6. Phase 3 Active Game Scoreboard & Player Actions ─────────────
    if (this.store.appPhase() === 'game') {
      const activePickerId = this.store.buildPickerPlayerId();

      if (activePickerId !== null) {
        const scores = this.store.playerScores();
        const row = scores.find(r => r.color.id === activePickerId);

        if (!this.store.showPlayCardMenu()) {
          // Build actions: 1=Road, 2=Settlement, 3=City, 4=Buy Dev Card, 5=Play Dev Card Menu
          if (!ctrlOrCmd && ['1', '2', '3', '4', '5'].includes(key)) {
            event.preventDefault();
            if (key === '1' && row && row.roadsCount < 15) {
              this.store.activeBuildTool.set('road');
              this.store.closePlayerBuildMenu();
            } else if (key === '2' && row && row.settlementsCount < 5) {
              const vertices = this.store.scoredVertices();
              const canBuild = vertices.some(
                v =>
                  !v.isOccupied && !v.isBlocked && this.store.hasRoadConnected(v.id, row.color.id),
              );
              if (canBuild) {
                this.store.activeBuildTool.set('settlement');
                this.store.closePlayerBuildMenu();
              }
            } else if (key === '3' && row && row.citiesCount < 4 && row.settlementsCount > 0) {
              this.store.activeBuildTool.set('city');
              this.store.closePlayerBuildMenu();
            } else if (key === '4') {
              const canPurchase =
                this.store.remainingTotal() -
                  Object.values(this.store.devCardsPurchased()).reduce((s, n) => s + n, 0) >
                0;
              if (canPurchase) {
                this.store.purchaseDevCard(activePickerId);
                this.store.closePlayerBuildMenu();
              }
            } else if (key === '5' && row && row.devCardsInHand > 0) {
              this.store.showPlayCardMenu.set(true);
            }
            return;
          }
        } else if (!ctrlOrCmd && ['1', '2', '3', '4', '5'].includes(key)) {
          // Play Dev Card sub-menu: 1=Knight, 2=VictoryPoint, 3=Monopoly, 4=RoadBuilding, 5=YearOfPlenty
          event.preventDefault();
          const cardTypeMap: Record<string, DevCardType> = {
            '1': 'knight',
            '2': 'victoryPoint',
            '3': 'monopoly',
            '4': 'roadBuilding',
            '5': 'yearOfPlenty',
          };
          const cardType = cardTypeMap[key];
          if (cardType) {
            const deck = this.store.activeDeckConfig();
            const played = this.store.totalPlayedByType();
            if (played[cardType] < deck[cardType] && row && row.devCardsInHand > 0) {
              this.store.playDevCard(activePickerId, cardType);
              this.store.closePlayerBuildMenu();
            }
          }
          return;
        }
      } else if (!this.store.selectedVertexId() && !this.store.selectedHexId()) {
        // No vertex/hex selected: number keys 1-6 open player build menu by current scoreboard rank (#1, #2, etc.)
        if (!ctrlOrCmd && ['1', '2', '3', '4', '5', '6'].includes(key)) {
          const rankIdx = Number(key) - 1;
          const scores = [...this.store.playerScores()].sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score;
            }
            return b.avgProd - a.avgProd;
          });
          if (scores[rankIdx]) {
            event.preventDefault();
            this.store.openPlayerBuildMenu(scores[rankIdx].color.id);
            return;
          }
        }
      }
    }

    // Final Classification Phase Enter / Space -> Continue Game
    if (
      (key === 'enter' || key === ' ' || key === 'spacebar') &&
      this.store.appPhase() === 'results' &&
      this.store.isSetupComplete()
    ) {
      event.preventDefault();
      this.store.startGamePhase();
    }
  }

  /**
   * Handles keyboard events when focus is inside a player name input element.
   */
  private handlePlayerNameInputKeyDown(event: KeyboardEvent, target: HTMLInputElement): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      target.blur();
      return;
    }

    const key = event.key.toLowerCase();
    const ctrlOrCmd = event.ctrlKey || event.metaKey;
    const shortcuts = this.i18n.t().shortcuts;

    // Parse player index from element ID e.g. "player-name-input-2"
    const match = /^player-name-input-(\d+)$/.exec(target.id);
    if (!match) return;
    const idx = Number.parseInt(match[1], 10);
    const colors = this.store.playerColors();
    const totalCount = colors.length;

    // Ctrl+M (EN) or Ctrl+Y (ES / selectMe key) -> Set as "Me"
    const isSelectMeKey = key === 'm' || key === 'y' || key === shortcuts.selectMe.toLowerCase();

    if (ctrlOrCmd && isSelectMeKey) {
      event.preventDefault();
      const color = colors[idx];
      if (color) {
        this.store.setMyPlayerColorId(color.id);
      }
      return;
    }

    // Tab / Shift+Tab -> Cycle focus to next / previous player name input
    if (event.key === 'Tab') {
      event.preventDefault();
      const targetIdx = event.shiftKey
        ? (idx - 1 + totalCount) % totalCount
        : (idx + 1) % totalCount;
      const nextInput = document.getElementById(
        `player-name-input-${targetIdx}`,
      ) as HTMLInputElement | null;
      nextInput?.focus();
      nextInput?.select();
    }
  }
}
