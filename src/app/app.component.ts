import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateService } from './core/services/update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent {
  constructor() {
    inject(UpdateService);
  }
}
