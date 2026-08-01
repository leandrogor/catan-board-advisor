import { Component, inject, computed } from '@angular/core';
import { TranslationService } from '../../../../core/services/translation.service';
import { KeyboardShortcutsService } from '../../../../core/services/keyboard-shortcuts.service';
import { BoardStateStore } from '../../services/board-state.store';

export interface ShortcutItem {
  key: string;
  label: string;
}

@Component({
  selector: 'app-shortcuts-help-modal',
  standalone: true,
  imports: [],
  templateUrl: './shortcuts-help-modal.component.html',
})
export class ShortcutsHelpModalComponent {
  protected readonly i18n = inject(TranslationService);
  protected readonly shortcuts = inject(KeyboardShortcutsService);
  protected readonly store = inject(BoardStateStore);

  protected readonly phaseLabel = computed(() => {
    const phase = this.store.appPhase();
    const isSetupComplete = this.store.isSetupComplete();
    const t = this.i18n.t();

    if (phase === 'setup') return t.shortcutsPhaseSetup;
    if (phase === 'results' && !isSetupComplete) return t.shortcutsPhasePlacement;
    return t.shortcutsPhaseGame;
  });

  protected readonly phaseShortcuts = computed<ShortcutItem[]>(() => {
    const phase = this.store.appPhase();
    const isSetupComplete = this.store.isSetupComplete();
    const t = this.i18n.t();
    const sc = t.shortcuts;

    if (phase === 'setup') {
      return [
        { key: '3 - 6', label: t.shortcutsItemPlayerCount },
        { key: sc.focusFirstName.toUpperCase(), label: t.shortcutsItemFocusFirstName },
        { key: 'Tab / Shift+Tab', label: t.shortcutsItemCycleNames },
        { key: `Ctrl + ${sc.selectMe.toUpperCase()}`, label: t.shortcutsItemSelectMe },
        { key: sc.toggleSetupNumbers.toUpperCase(), label: t.shortcutsItemToggleSetupNumbers },
        { key: sc.startSimulation.toUpperCase(), label: t.shortcutsItemStartSim },
        { key: sc.loadSnapshot.toUpperCase(), label: t.shortcutsItemLoadSnapshot },
        { key: 'Esc', label: t.shortcutsItemUnfocusInput },
      ];
    }

    if (phase === 'results' && !isSetupComplete) {
      return [
        { key: '1 - 9', label: t.shortcutsItemSelectRankedVertex },
        { key: 'Enter', label: t.shortcutsItemConfirmSettlement },
        { key: '1, 2, 3', label: t.shortcutsItemSelectRoadDir },
        { key: 'Esc', label: t.shortcutsItemCancelPlacement },
      ];
    }

    // Game Phase (Fase 3)
    return [
      { key: '1 - 6', label: t.shortcutsItemOpenPlayerMenu },
      { key: t.shortcutsInMenu(1), label: t.shortcutsItemBuildRoad },
      { key: t.shortcutsInMenu(2), label: t.shortcutsItemBuildSettlement },
      { key: t.shortcutsInMenu(3), label: t.shortcutsItemBuildCity },
      { key: t.shortcutsInMenu(4), label: t.shortcutsItemBuyDevCard },
      { key: t.shortcutsInMenu(5), label: t.shortcutsItemOpenPlayCardSubmenu },
      { key: t.shortcutsInCards(1), label: t.shortcutsItemPlayKnight },
      { key: t.shortcutsInCards(2), label: t.shortcutsItemPlayVP },
      { key: t.shortcutsInCards(3), label: t.shortcutsItemPlayMonopoly },
      { key: t.shortcutsInCards(4), label: t.shortcutsItemPlayRoadBuilding },
      { key: t.shortcutsInCards(5), label: t.shortcutsItemPlayYearOfPlenty },
      { key: sc.devCards.toUpperCase(), label: t.shortcutsItemDevCardsPanel },
      { key: sc.stats.toUpperCase(), label: t.shortcutsItemStatsPanel },
      { key: sc.saveSnapshot.toUpperCase(), label: t.shortcutsItemSaveSnapshot },
      { key: 'Esc', label: t.shortcutsItemCancelBuildTool },
    ];
  });

  protected readonly globalShortcuts = computed<ShortcutItem[]>(() => {
    const t = this.i18n.t();
    const sc = t.shortcuts;

    return [
      { key: 'Ctrl + Z / Y', label: t.shortcutsItemUndoRedo },
      { key: sc.rotateBoard.toUpperCase(), label: t.shortcutsItemRotateBoard },
      { key: sc.darkMode.toUpperCase(), label: t.shortcutsItemDarkMode },
      { key: sc.toggleProductionFormat.toUpperCase(), label: t.shortcutsItemProductionFormat },
      { key: sc.settings.toUpperCase(), label: t.shortcutsItemSettingsDrawer },
      { key: '? / H', label: t.shortcutsItemHelpModal },
    ];
  });

  protected close(): void {
    this.shortcuts.helpModalOpen.set(false);
  }
}
