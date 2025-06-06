/***************************************************************************************************
 * Load `$localize` onto the global scope - used if i18n tags appear in Angular templates.
 */
import '@angular/localize/init';

/***************************************************************************************************
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 *
 * This file is divided into 2 sections:
 *   1. Browser polyfills. These are applied before loading ZoneJS and are sorted by browsers.
 *   2. Application imports. Files imported after ZoneJS that should be loaded before your main
 *      file.
 *
 * The current setup is for so-called "evergreen" browsers; the last versions of browsers that
 * automatically update themselves. This includes Safari >= 10, Chrome >= 55 (including Opera),
 * Edge >= 13 on the desktop, and iOS 10 and Chrome on mobile.
 *
 * Learn more in https://angular.io/guide/browser-support
 */

/***************************************************************************************************
 * BROWSER POLYFILLS
 */

/**
 * To configure zone.js behavior (e.g. disable patching certain APIs),
 * create a separate file named `zone-flags.ts` and set the flags *before* importing zone.js.
 * Example:
 *   import './zone-flags.ts';
 *
 * Available flags:
 * (window as any).__Zone_disable_requestAnimationFrame = true;
 * (window as any).__Zone_disable_on_property = true;
 * (window as any).__zone_symbol__UNPATCHED_EVENTS = ['scroll', 'mousemove'];
 * (window as any).__Zone_enable_cross_context_check = true; // IE/Edge only
 */

/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js';
(window as any).global = window;

/***************************************************************************************************
 * APPLICATION IMPORTS
 */