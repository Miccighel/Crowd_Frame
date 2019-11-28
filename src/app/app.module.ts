import {NgModule, Injector} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {HttpClientModule} from '@angular/common/http';
import {CrowdFormComponent} from "./crowdForm/crowdform.component";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {BrowserModule} from "@angular/platform-browser";
import {MatCardModule} from '@angular/material/card';
import {MatInputModule} from '@angular/material/input';
import {MatStepperModule} from '@angular/material/stepper';
import {MatButtonModule} from '@angular/material/button';
import {MatRadioModule} from '@angular/material/radio';
import {ReactiveFormsModule} from "@angular/forms";

@NgModule({
  declarations: [
    CrowdFormComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatStepperModule,
    MatRadioModule,
    HttpClientModule,
    ReactiveFormsModule,
  ],
  entryComponents: [
    CrowdFormComponent
  ],
  providers: [],
})

export class AppModule {

  constructor(injector: Injector) {
    const custom = createCustomElement(CrowdFormComponent, {injector: injector});
    customElements.define('app-crowd-form', custom);
  }

  ngDoBootstrap() {}

}
