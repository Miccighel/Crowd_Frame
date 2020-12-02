import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {SkeletonComponent, AnnotationDialog} from "./components/skeleton/skeleton.component";
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
import {ReactiveFormsModule} from "@angular/forms";
import {NgxUiLoaderConfig, NgxUiLoaderModule} from "ngx-ui-loader";
import {HttpClientModule} from "@angular/common/http";
import {CrowdXplorer} from "./components/crowd-xplorer/crowd-xplorer.component";
import {createCustomElement} from "@angular/elements";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatBadgeModule} from "@angular/material/badge";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatExpansionModule} from "@angular/material/expansion";
import {TruncatePipe} from "./pipes/truncatePipe";
import {MatIconModule} from "@angular/material/icon";
import {MatTreeModule} from '@angular/material/tree';
import {MatToolbarModule} from "@angular/material/toolbar";
import {InstructionsComponent, InstructionsDialog} from "./components/instructions/instructions.component";
import {MatDialogModule} from "@angular/material/dialog";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatSliderModule} from "@angular/material/slider";
import {MatTooltipModule} from "@angular/material/tooltip";
import { CountdownModule } from 'ngx-countdown';
import { GeneratorComponent } from './components/generator/generator.component';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import { NgxFileHelpersModule } from 'ngx-file-helpers';
import {LoaderComponent} from './components/loader/loader.component';


@NgModule({
  declarations: [
    SkeletonComponent,
    CrowdXplorer,
    TruncatePipe,
    InstructionsComponent,
    InstructionsDialog,
    GeneratorComponent,
    LoaderComponent,
    AnnotationDialog
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
  providers: [],
})

export class AppModule {

  constructor(injector: Injector) {
    const loaderElement = createCustomElement(LoaderComponent, {injector: injector});
    customElements.define('app-loader', loaderElement);
    const skeletonElement = createCustomElement(SkeletonComponent, {injector: injector});
    customElements.define('app-skeleton', skeletonElement);
    const bingerElement = createCustomElement(CrowdXplorer, {injector: injector});
    customElements.define('app-crowd-xplorer', bingerElement);
  }

  ngDoBootstrap() {
  }

}
