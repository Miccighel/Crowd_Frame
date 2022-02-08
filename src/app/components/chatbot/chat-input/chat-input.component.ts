import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, ViewEncapsulation } from '@angular/core'

@Component({
  selector: 'chat-input',
  templateUrl: 'chat-input.component.html',
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./chat-input.component.css'],
})
export class ChatInputComponent implements OnInit {
  @Input() public buttonText = '↩︎'
  @Input() public focus = new EventEmitter()
  @Output() public send = new EventEmitter()
  @Input() public pholder! : string
  @Input() public disableInput! : string
  @ViewChild('message', { static: true }) message!: ElementRef
  @ViewChild('buttons') buttons!: ElementRef

  ngOnInit() {
    this.focus.subscribe(() => this.focusMessage())
  }

  // focus permette di selezionare automaticamente un'area del html
  public focusMessage() {
    this.message.nativeElement.focus()
  }

  public getMessage() {
    return this.message.nativeElement.value
  }

  public clearMessage() {
    this.message.nativeElement.value = ''
  }

  onSubmit() {
    // prendo il msg, se è vuoto non faccio nulla
    const message = this.getMessage()
    
    if (message.trim() === '') {
      return
    }
    // invio il messaggio
    this.send.emit({ message })
    // resetto l'input field
    this.clearMessage()
    this.focusMessage()
  }

  ngOnChanges(){
    this.message.nativeElement.value=this.pholder
    this.message.nativeElement.disabled=this.disableInput
  }
}
