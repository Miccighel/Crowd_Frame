import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnInit, ViewChild } from '@angular/core'
import { Subject } from 'rxjs'
import { fadeIn } from '../animations'
import {NgxUiLoaderService} from 'ngx-ui-loader';
import { start } from 'repl';
import { Dimension } from 'aws-sdk/clients/costexplorer';

// creo msg random di risposta
const randomMessages = [
  'Nice to meet you',
  'Hello!',
  'How are you?',
  'Not too bad, thanks',
  'What do you do?',
  'Can I help you?',
  'That\'s awesome',
  'Bye',
  ':)',
]

// funzioncine per prendere il random msg
const rand = (max: number) => Math.floor(Math.random() * max)
const getRandomMessage = () => randomMessages[rand(randomMessages.length)]

@Component({
  selector: 'chat-widget',
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.css'],
  animations: [fadeIn],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatWidgetComponent implements OnInit {
  @ViewChild('bottom') bottom!: ElementRef
  @ViewChild('buttons', { static: true }) buttons!: ElementRef
  @ViewChild('typing', { static: true }) typing!: ElementRef
  @Input() private questionnaires!: any
  @Input() private docs!: any
  @Input() private settings!: any
  @Input() private instructions!: any

  @Input() private taskInstructions!: any
  @Input() private hits!: any
  @Input() private dims!: any

  changeDetector: ChangeDetectorRef;
  ngxService: NgxUiLoaderService;
  fixedMessage : string;
  expectedTypeOfMessage : string
  repeat:string
  subTaskIndex = 0;
  taskIndex = 0;
  instructionPhase = false
  taskPhase = false
  endTaskPhase= false
  statementProvided=false
  firstMsg=true
  reviewPhase=false
  reviewAnswersShown=false
  ignoreMsg:boolean
  answers : string[] = [];

  instr = ["Hi! Instructions for the task: ...", "Would you like to play a test round?"];
  dimensions = ["Truthfulness", "Confidence", "Correctness"];
  dimensionsDescription = [
    "state if the statement is true, as opposed to false.",
    "you consider yourself knowledgeable/expert about the topic, as opposed to novice/beginner.",
    "the statement is expressed in an accurate way, as opposed to being incorrect and/or reporting  mistaken information.",
  ];
  hit = [
    "6,400 Ohioans ... lost manufacturing jobs in the month of September. - Mitt Romney 2012",
    "Yes, We can! - Barack Obama 2008"
  ];
  taskReview = [];
  endOfTaskMessage = ["Thank you for completing the task!"];

  constructor(changeDetector: ChangeDetectorRef, ngxService: NgxUiLoaderService) {
    this.changeDetector=changeDetector
    this.ngxService=ngxService
  }
  public focus = new Subject()

  public operator = {
    name: 'Fake News Bot',
    status: 'online',
    avatar:'https://randomuser.me/api/portraits/lego/0.jpg'
  }

  public client = {
    name: 'Worker',
    user: 'test_user',
    status: 'online',
    avatar: `https://storage.proboards.com/6172192/images/gKhXFw_5W0SD4nwuMev1.png`,
  }

  public messages: any[] = []

  public addMessage(from: { name: string; status: string; avatar: string; user?: string; }, text: string, type: 'received' | 'sent') {
    // unshift aggiunge elementi all'inizio del vettore
    this.messages.unshift({
      from,
      text,
      type,
      date: new Date().getTime(),
    })
    this.scrollToBottom()
  }

  // scrolla diretto in fondo
  public scrollToBottom() {
    if (this.bottom !== undefined) {
      this.bottom.nativeElement.scrollIntoView()
    }
  }

  // inutilizzato
  public focusMessage() {
    this.focus.next(true)
  }

  // invio un msg random
  public randomMessage() {
    this.addMessage(this.operator, getRandomMessage(), 'received')
  }

  // all'inizio invio dei messaggi di benvenuto
  ngOnInit() {
    // stampo le istruzioni iniziali
    this.typing.nativeElement.style.display="none"
    this.instructionPhase=true
    console.log(this.dims)
    this.addMessage(this.operator, this.instr[0], 'received')
    this.addMessage(this.operator, this.instr[1], 'received')
    this.ignoreMsg=false
    //this.addMessage(this.operator, this.dims[0].name_pretty, 'received')
    //this.addMessage(this.operator, this.taskInstructions[0].text, 'received')
  }

  // aggiunta del msg alla chat
  public sendMessage({ message }:any) {
    //setTimeout(() => this.typing.nativeElement.style.display="block", 0)
    if (message.trim() === '') {
      return
    }
    
    this.addMessage(this.client, message, 'sent')
    if (this.ignoreMsg){return}

    // END TASK PHASE
    if (this.endTaskPhase){
      this.endP()
      return
    }

    //INSTRUCTION PHASE
    if (this.instructionPhase) {
      this.instructionP(message)
    }
    
    //TASK PHASE
    if (this.taskPhase){
      this.taskP(message)
    }
    
    //REVIEW PHASE
    if (this.reviewPhase){
      this.reviewP(message)
    }

    this.scrollToBottom()
  
  }


  private instructionP(message:string){
    let startMsg: string
      if (message.trim() === "Yes") {
        startMsg="Then let's start!"
      }
      else if (message.trim() === "No") {
        startMsg="Then let's skip!"
        //skip one task
        this.taskIndex+=1
      } else {return}
      this.typingAnimation(startMsg)
      //this.addMessage(this.operator, startMsg, 'received')
      this.buttons.nativeElement.style.display="none"
      this.taskPhase=true; //passiamo alla next phase
      this.instructionPhase=false; //finiamo la instruction phase
      this.firstMsg=true

  }

  private taskP(message:string){
    this.answers[this.subTaskIndex-1]=message
    // fine subtask
    if (this.dimensions.length <= this.subTaskIndex  &&  this.validMsg(message)){
      this.endOfSubtask()
      this.reviewP(message)
      return
    }
    //controllo il msg
    if (!this.validMsg(message) && !this.firstMsg){
      this.repeat="Please type a number between 1 and 5"
      this.typingAnimation(this.repeat)
      //this.addMessage(this.operator, "Please type a number between 1 and 5", 'received')
      return
    } 
    else {
      //Altrimenti, SUBTASK
      if (!this.statementProvided){
        this.printStatement()
      }
    this.printDimension()
    this.answers[this.subTaskIndex]=message
    }
    //non eseguo controlli sul primo msg, ma sugli altri si
    this.firstMsg=false
    }

  

  private reviewP(message:string){
    if (!this.reviewAnswersShown){
      this.buttons.nativeElement.style.display="inline-block"
      //this.addMessage(this.operator, "Let's review your answers! Proceed?", 'received')
      this.typingAnimation("Let's review your answers!")
      for (let i=0; i<this.dimensions.length ;i++){
        this.typingAnimation(this.dimensions[i]+": "+this.answers[i])
      }
      this.typingAnimation("Confirm your answers?")
      this.reviewAnswersShown=true;
    }
    if (message.trim() === "Yes") {
      this.reviewPhase=false
      this.taskPhase=true
      this.taskIndex+=1
      this.reviewAnswersShown=false
      this.firstMsg=true
      
      if (this.hit.length <= this.taskIndex){
        this.endP()
        return
      } 
    }
    else if (message.trim() === "No") {
      //redo
      this.reviewPhase=false
      this.taskPhase=true
      this.reviewAnswersShown=false
      this.firstMsg=true
      this.typingAnimation("Let's try that again!")
    } else {return}
    this.buttons.nativeElement.style.display="none"
    this.subTaskIndex=0
    this.taskP(message)
  }

  private endP(){
    //this.addMessage(this.operator, this.endOfTaskMessage[0], 'received')
    this.typingAnimation(this.endOfTaskMessage[0])
    this.endTaskPhase=false
  }

  private endOfSubtask(){
    this.statementProvided=false
    this.taskPhase=false
    this.reviewPhase=true
  }

  private endOfTask(){
    this.endTaskPhase=true
    this.taskPhase=false
  }

  private printStatement(){
    //this.addMessage(this.operator, "Statement: "+ this.hit[this.taskIndex], 'received')
    this.typingAnimation("Statement: "+ this.hit[this.taskIndex])
    this.fixedMessage = this.hit[this.taskIndex]
    this.statementProvided=true;
  }

  private printDimension(){
    /*this.addMessage(this.operator, 
      "Please rate the " + this.dimensions[this.subTaskIndex] + " of the statement. Please type a number between 1 and 5. "+
      this.dimensions[this.subTaskIndex] + ": " + this.dimensionsDescription[this.subTaskIndex], 'received')
    *///this.currentAnswers[this.subTaskIndex]=message
    this.typingAnimation( "Please rate the " + this.dimensions[this.subTaskIndex] + " of the statement. Please type a number between 1 and 5. "+
    this.dimensions[this.subTaskIndex] + ": " + this.dimensionsDescription[this.subTaskIndex])
    this.subTaskIndex+=1;
  }

  private validMsg(msg){
    if ((isNaN(+msg) || (+msg < 1 || +msg > 5))){
      return false
    }
    return true
  }

  // aggiunta del msg alla chat
  public buttonInput(message : string) {
    this.sendMessage({message})
    this.buttons.nativeElement.style.display="none"
  }

  public typingAnimation(message:string){
    this.typing.nativeElement.style.display="block"
    this.ignoreMsg=true
    setTimeout(() => this.typing.nativeElement.style.display="none", 1000)
    setTimeout(() => this.addMessage(this.operator, message, 'received'), 1000)
    setTimeout(() => this.changeDetector.detectChanges(), 1000)
    setTimeout(() => this.scrollToBottom(), 1000)
    setTimeout(() => this.ignoreMsg=false, 1000)
  }
}

