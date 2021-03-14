import {Directive, HostListener} from "@angular/core";
import {ActionLogger} from "../../../../data/build/ActionLogger";

@Directive({selector: "button"})
export class ButtonDirective {
  constructor(private actionLogger: ActionLogger) {}
  @HostListener('click', ['$event']) onClick(event){
    console.log(event)
    this.actionLogger.onClick()
  }
}
