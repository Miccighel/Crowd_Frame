/***************************************************************************************************
 * Inline polyfills – moved here so the Angular builder produces ONE bundle (main.js)
 ***************************************************************************************************/
import 'zone.js';                 // Angular change-detection runtime

/***************************************************************************************************
 * Usual bootstrap code
 ***************************************************************************************************/
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from "../data/build/environments/environment";

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));
