import { Injectable, signal, computed } from '@angular/core';
import { EN, Translations } from '../../features/board-advisor/i18n/en.translations';
import { ES } from '../../features/board-advisor/i18n/es.translations';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly lang = signal<'en' | 'es'>(
    (localStorage.getItem('catan-lang') as 'en' | 'es') ??
      (navigator.language.startsWith('es') ? 'es' : 'en'),
  );
  readonly t = computed<Translations>(() => (this.lang() === 'en' ? EN : ES));

  toggle(): void {
    const next = this.lang() === 'en' ? 'es' : 'en';
    localStorage.setItem('catan-lang', next);
    this.lang.set(next);
  }
}
