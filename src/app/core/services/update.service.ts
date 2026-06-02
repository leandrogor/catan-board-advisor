import { ApplicationRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, interval } from 'rxjs';
import { filter, first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  constructor() {
    if (this.swUpdate.isEnabled) {
      // Listen for version updates from the service worker
      this.swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => {
          if (
            confirm('Una nueva versión de la aplicación está disponible. ¿Deseas actualizar ahora?')
          ) {
            globalThis.location.reload();
          }
        });

      // Periodically check for updates
      // Wait for app to stabilize first, then check every 6 hours
      const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable));
      const everySixHours$ = interval(6 * 60 * 60 * 1000);
      const everySixHoursOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

      everySixHoursOnceAppIsStable$.subscribe(async () => {
        await this.swUpdate.checkForUpdate();
      });
    }
  }
}
