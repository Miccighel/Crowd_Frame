import {NgModule, Injector} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {HttpClientModule} from '@angular/common/http';
import {SkeletonComponent} from "./skeleton/skeleton.component";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {BrowserModule} from "@angular/platform-browser";
import {MatCardModule} from '@angular/material/card';
import {MatInputModule} from '@angular/material/input';
import {MatStepperModule} from '@angular/material/stepper';
import {MatButtonModule} from '@angular/material/button';
import {MatRadioModule} from '@angular/material/radio';
import {MatTabsModule} from "@angular/material/tabs";
import {ReactiveFormsModule} from "@angular/forms";
import {MatDividerModule} from "@angular/material/divider";
import {MatListModule} from "@angular/material/list";
import {NgxUiLoaderModule} from "ngx-ui-loader";
import {MatGridListModule} from "@angular/material/grid-list";

@NgModule({
  declarations: [
    SkeletonComponent,
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
    ReactiveFormsModule,
    NgxUiLoaderModule,
    HttpClientModule,
  ],
  entryComponents: [
    SkeletonComponent
  ],
  providers: [],
})

export class AppModule {

  constructor(injector: Injector) {
    const skeletonElement = createCustomElement(SkeletonComponent, {injector: injector});
    customElements.define('app-skeleton', skeletonElement);
  }

  ngDoBootstrap() {}

}
