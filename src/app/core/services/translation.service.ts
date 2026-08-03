import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { EN, Translations } from '../../features/board-advisor/i18n/en.translations';
import { ES } from '../../features/board-advisor/i18n/es.translations';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly document = inject(DOCUMENT);

  readonly lang = signal<'en' | 'es'>(
    (() => {
      const saved = localStorage.getItem('catan-lang');
      if (saved === 'en' || saved === 'es') return saved;
      return navigator.language.startsWith('es') ? 'es' : 'en';
    })(),
  );
  readonly t = computed<Translations>(() => (this.lang() === 'en' ? EN : ES));

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.lang();
    });
  }

  toggle(): void {
    const next = this.lang() === 'en' ? 'es' : 'en';
    localStorage.setItem('catan-lang', next);
    this.lang.set(next);
  }
}
