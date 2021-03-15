import {Directive, HostListener} from "@angular/core";
import {ActionLogger} from "../../services/userActionLogger.service";

@Directive({selector: "button"})
export class ButtonDirective {
  constructor(private actionLogger: ActionLogger) {}
  @HostListener('click', ['$event']) buttonClick(event){
    event.stopPropagation()
    this.actionLogger.buttonClick(event)
  }
}

@Directive({selector: "app-skeleton"})
export class WindowDirective{
  constructor(private actionLogger: ActionLogger) {}
  @HostListener('window:click', ['$event']) windowClick(event){
    event.stopPropagation()
    this.actionLogger.windowClick(event)
  }

  @HostListener('copy', ['$event']) onCopy(event){
    this.actionLogger.onCopy(event)
  }

  @HostListener('paste', ['$event']) onPaste(event){
    this.actionLogger.onPaste(event)
  }

  @HostListener('cut', ['$event']) onCut(event){
    this.actionLogger.onCut(event)
  }
}
