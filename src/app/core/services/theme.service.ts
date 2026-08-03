import { Injectable, signal, computed, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<'light' | 'dark'>(
    (() => {
      const saved = localStorage.getItem('catan-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return typeof globalThis !== 'undefined' &&
        typeof globalThis.matchMedia === 'function' &&
        globalThis.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    })(),
  );
  readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDark());
      localStorage.setItem('catan-theme', this._theme());
    });
  }

  toggle(): void {
    this._theme.update(t => (t === 'light' ? 'dark' : 'light'));
  }
}
