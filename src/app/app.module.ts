import {NgModule, Injector} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {HttpClientModule} from '@angular/common/http';
import {Skeleton} from "./skeleton/skeleton.component";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {BrowserModule} from "@angular/platform-browser";
import {MatCardModule} from '@angular/material/card';
import {MatInputModule} from '@angular/material/input';
import {MatStepperModule} from '@angular/material/stepper';
import {MatButtonModule} from '@angular/material/button';
import {MatRadioModule} from '@angular/material/radio';
import {MatGridListModule} from '@angular/material/grid-list';
import {ReactiveFormsModule} from "@angular/forms";
import {MatDividerModule} from "@angular/material/divider";

@NgModule({
  declarations: [
    Skeleton,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatStepperModule,
    MatRadioModule,
    MatGridListModule,
    MatDividerModule,
    HttpClientModule,
    ReactiveFormsModule,
  ],
  entryComponents: [
    Skeleton
  ],
  providers: [],
})

export class AppModule {

  constructor(injector: Injector) {
    const skeletonElement = createCustomElement(Skeleton, {injector: injector});
    customElements.define('app-skeleton', skeletonElement);
  }

  ngDoBootstrap() {}

}
