import {BrowserModule} from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {SkeletonComponent} from "./components/skeleton/skeleton.component";
import {MatRadioModule} from "@angular/material/radio";
import {MatCardModule} from "@angular/material/card";
import {MatInputModule} from "@angular/material/input";
import {MatButtonModule} from "@angular/material/button";
import {MatStepperModule} from "@angular/material/stepper";
import {MatDividerModule} from "@angular/material/divider";
import {MatTabsModule} from "@angular/material/tabs";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatListModule} from "@angular/material/list";
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
import {MatToolbarModule} from "@angular/material/toolbar";
import {InstructionsComponent, InstructionsDialog} from "./components/instructions/instructions.component";
import {MatDialogModule} from "@angular/material/dialog";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatSliderModule} from "@angular/material/slider";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";

const ngxUiLoaderConfig: NgxUiLoaderConfig = {
  bgsColor: "#3f51b5",
  bgsOpacity: 0.7,
  bgsPosition: "bottom-right",
  bgsSize: 80,
  bgsType: "ball-spin-clockwise",
  blur: 15,
  delay: 0,
  fastFadeOut: true,
  fgsColor: "#3f51b5",
  fgsPosition: "center-center",
  fgsSize: 150,
  fgsType: "ball-spin-clockwise",
  gap: 24,
  logoPosition: "center-center",
  logoSize: 120,
  logoUrl: "",
  masterLoaderId: "master",
  overlayBorderRadius: "0",
  overlayColor: "rgba(40,40,40,0.64)",
  pbColor: "#3f51b5",
  pbDirection: "ltr",
  pbThickness: 3,
  hasProgressBar: true,
  text: "Loading...",
  textColor: "#FFFFFF",
  textPosition: "bottom-center",
  maxTime: -1,
  minTime: 300
};

@NgModule({
  declarations: [
    SkeletonComponent,
    CrowdXplorer,
    TruncatePipe,
    InstructionsComponent,
    InstructionsDialog
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatStepperModule,
    MatRadioModule,
    MatDividerModule,
    MatTabsModule,
    MatGridListModule,
    MatListModule,
    MatToolbarModule,
    ReactiveFormsModule,
    NgxUiLoaderModule.forRoot(ngxUiLoaderConfig),
    HttpClientModule,
    BrowserModule,
    BrowserAnimationsModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatTableModule,
    MatPaginatorModule,
    MatExpansionModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatSliderModule,
    MatDividerModule,
    NgxUiLoaderModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatCheckboxModule,
    FontAwesomeModule
  ],
  providers: [],
})

export class AppModule {

  constructor(injector: Injector) {
    const skeletonElement = createCustomElement(SkeletonComponent, {injector: injector});
    customElements.define('app-skeleton', skeletonElement);
    const bingerElement = createCustomElement(CrowdXplorer, {injector: injector});
    customElements.define('app-crowd-xplorer', bingerElement);
  }

  ngDoBootstrap() {
  }

}
