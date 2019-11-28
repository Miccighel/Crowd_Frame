import {NgModule, Injector} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {HttpClientModule} from '@angular/common/http';
import {CrowdFormComponent} from "./crowdForm/crowdform.component";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {BrowserModule} from "@angular/platform-browser";

@NgModule({
  declarations: [
    CrowdFormComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
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
