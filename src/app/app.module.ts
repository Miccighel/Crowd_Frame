/* Core imports */
import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {HttpClientModule} from "@angular/common/http";
import {createCustomElement} from "@angular/elements";
/* Reactive forms imports */
import {ReactiveFormsModule} from "@angular/forms";
/* Angular Material imports */
import {MatRadioModule} from "@angular/material/radio";
import {MatCardModule} from "@angular/material/card";
import {MatInputModule} from "@angular/material/input";
import {MatFormFieldModule } from '@angular/material/form-field';
import {MatSelectModule} from "@angular/material/select";
import {MatButtonModule} from "@angular/material/button";
import {MatStepperModule} from "@angular/material/stepper";
import {MatDividerModule} from "@angular/material/divider";
import {MatTabsModule} from "@angular/material/tabs";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatListModule} from "@angular/material/list";
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatBadgeModule} from "@angular/material/badge";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatIconModule} from "@angular/material/icon";
import {MatTreeModule} from '@angular/material/tree';
import {MatDialogModule} from "@angular/material/dialog";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatSliderModule} from "@angular/material/slider";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
/* Components imports */
import {SkeletonComponent} from "./components/skeleton/skeleton.component";
import {CrowdXplorer} from "./components/crowd-xplorer/crowd-xplorer.component";
import {InstructionsComponent, InstructionsDialog} from "./components/instructions/instructions.component";
import {GeneratorComponent } from './components/generator/generator.component';
import {LoaderComponent} from './components/loader/loader.component';
/* Pipes import */
import {TruncatePipe} from "./pipes/truncatePipe";
/* Other imports */
import {NgxUiLoaderModule} from "ngx-ui-loader";
import {CountdownModule } from 'ngx-countdown';
import {NgxFileHelpersModule} from 'ngx-file-helpers';
import {ActionLogger} from "./services/userActionLogger.service";
import {ButtonDirective} from "./components/skeleton/skeleton.directive";

@NgModule({
  declarations: [
    SkeletonComponent,
    CrowdXplorer,
    TruncatePipe,
    InstructionsComponent,
    InstructionsDialog,
    GeneratorComponent,
    LoaderComponent,
    ButtonDirective
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatStepperModule,
    MatRadioModule,
    MatDividerModule,
    MatTabsModule,
    MatFormFieldModule,
    MatGridListModule,
    MatListModule,
    MatToolbarModule,
    ReactiveFormsModule,
    NgxUiLoaderModule,
    HttpClientModule,
    BrowserModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatTreeModule,
    MatTableModule,
    MatPaginatorModule,
    MatExpansionModule,
    MatSnackBarModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatSliderModule,
    MatDividerModule,
    NgxUiLoaderModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatCheckboxModule,
    MatTooltipModule,
    CountdownModule,
    MatSlideToggleModule,
    NgxFileHelpersModule
  ],
  providers: [ActionLogger],
})

export class AppModule {

  constructor(injector: Injector) {
    const loaderElement = createCustomElement(LoaderComponent, {injector: injector});
    customElements.define('app-loader', loaderElement);
    const skeletonElement = createCustomElement(SkeletonComponent, {injector: injector});
    customElements.define('app-skeleton', skeletonElement);
    const crowdXplorerElement = createCustomElement(CrowdXplorer, {injector: injector});
    customElements.define('app-crowd-xplorer', crowdXplorerElement);
  }

  ngDoBootstrap() {}

}
