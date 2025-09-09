/* ======================================================================
 * src/app/material.module.ts
 * Centralized Angular Material imports/exports for the whole app.
 * Grouped by category to keep things tidy.
 * ====================================================================== */

import {NgModule} from '@angular/core';

/* ----------------------------- Form controls ----------------------------- */
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatInputModule} from '@angular/material/input';
import {MatRadioModule} from '@angular/material/radio';
import {MatSelectModule} from '@angular/material/select';
import {MatSliderModule} from '@angular/material/slider';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';

/* -------------------------------- Navigation ----------------------------- */
/* Includes MatSidenavModule for the app shell / side drawer */
import {MatStepperModule} from '@angular/material/stepper';
import {MatTabsModule} from '@angular/material/tabs';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatSidenavModule} from '@angular/material/sidenav';

/* ---------------------------------- Layout -------------------------------- */
import {MatCardModule} from '@angular/material/card';
import {MatDividerModule} from '@angular/material/divider';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatListModule} from '@angular/material/list';

/* ----------------------- Buttons & progress indicators -------------------- */
import {MatBadgeModule} from '@angular/material/badge';
import {MatButtonModule} from '@angular/material/button';
import {MatChipsModule} from '@angular/material/chips';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

/* ------------------------------ Popups & modals --------------------------- */
import {MatDialogModule} from '@angular/material/dialog';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatTooltipModule} from '@angular/material/tooltip';

/* -------------------------------- Data table ------------------------------ */
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatTableModule} from '@angular/material/table';

@NgModule({
    exports: [
        /* ----------------------------- Form controls ----------------------------- */
        MatCheckboxModule,
        MatInputModule,
        MatRadioModule,
        MatSelectModule,
        MatSliderModule,
        MatSlideToggleModule,

        /* -------------------------------- Navigation ----------------------------- */
        MatStepperModule,
        MatTabsModule,
        MatToolbarModule,
        MatSidenavModule,

        /* ---------------------------------- Layout -------------------------------- */
        MatCardModule,
        MatDividerModule,
        MatExpansionModule,
        MatGridListModule,
        MatListModule,

        /* ----------------------- Buttons & progress indicators -------------------- */
        MatBadgeModule,
        MatButtonModule,
        MatChipsModule,
        MatIconModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,

        /* ------------------------------ Popups & modals --------------------------- */
        MatDialogModule,
        MatSnackBarModule,
        MatTooltipModule,

        /* -------------------------------- Data table ------------------------------ */
        MatPaginatorModule,
        MatTableModule
    ]
})
export class MaterialModule {
}
