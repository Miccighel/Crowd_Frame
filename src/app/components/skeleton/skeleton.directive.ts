import {Directive, HostListener} from "@angular/core";
import {ActionLogger} from "../../services/userActionLogger.service";

@Directive({selector: "button"})
export class ButtonDirective {
  constructor(private actionLogger: ActionLogger) {}
  @HostListener('click', ['$event']) onClick(event){
    this.actionLogger.onClick(event)
  }
}
