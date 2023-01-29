import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    EventEmitter,
    Component,
    ElementRef,
    Input,
    OnInit,
    ViewChild,
} from "@angular/core";
import { fadeIn } from "../animations";
import { NgxUiLoaderService } from "ngx-ui-loader";
import { S3Service } from "../../../services/aws/s3.service";
import { DynamoDBService } from "../../../services/aws/dynamoDB.service";
import { SectionService } from "../../../services/section.service";
import { ConfigService } from "../../../services/config.service";

/* Models */
import { Task } from "../../../models/skeleton/task";
import { ChatCommentModalComponent } from "../chat-comment-modal/chat-comment-modalcomponent";
import {
    AnswerModel,
    CategoricalInfo,
    DropdownSelectItem,
    EnConversationalInputType,
    EnConversationaTaskStatus,
    IntervalDimensionInfo,
    MagnitudeDimensionInfo,
} from "../../../models/conversational/common.model";

import { ScaleCategorical } from "../../../models/skeleton/dimension";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { GoldChecker } from "data/build/skeleton/goldChecker";
import ChatHelper from "./chat-helpers";
import { BehaviorSubject, Observable, Subject } from "rxjs";

// Messaggi random
const randomMessagesFirstPart = [
    "OK!",
    "Gotcha!",
    "Makes sense!",
    "Sure!",
    "I see!",
    "Thanks!",
    "Thank you!",
];

const randomMessagesSecondPart = [
    "Let's proceed...",
    "Let me write that down...",
    "The next question is...",
    "On to the next question...",
    "The following question is...",
    "Here's the next question...",
];

const rand = (max: number) => Math.floor(Math.random() * max);
const getRandomMessage = () =>
    randomMessagesFirstPart[rand(randomMessagesFirstPart.length)] +
    " " +
    randomMessagesSecondPart[rand(randomMessagesSecondPart.length)];

// Main
@Component({
    selector: "chat-widget",
    templateUrl: "./chat-widget.component.html",
    styleUrls: ["./chat-widget.component.css"],
    animations: [fadeIn],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWidgetComponent implements OnInit {
    @ViewChild("bottom") bottom!: ElementRef;

    @ViewChild("typing", { static: true }) typing!: ElementRef;
    @ViewChild("inputBox", { static: true }) inputBox!: ElementRef;
    @ViewChild("progressBar", { static: true }) progressBar!: ElementRef;

    //Search engine events
    resetSearchEngine: EventEmitter<void> = new EventEmitter<void>();
    disableSearchEngine: EventEmitter<boolean> = new EventEmitter<boolean>();
    readUrlValue: EventEmitter<void> = new EventEmitter<void>();

    @Input() private worker!: any;
    task: Task;
    changeDetector: ChangeDetectorRef;
    ngxService: NgxUiLoaderService;
    S3Service: S3Service;
    dynamoDBService: DynamoDBService;
    configService: ConfigService;
    sectionService: SectionService;

    // Indexes
    taskIndex: number; // Tiene il conto della task attuale
    subTaskIndex: number; // Tiene il conto della dimensione attuale
    currentQuestion: number;
    currentQuestionnaire: number;
    goldLow: number;
    goldHigh: number;

    /* Arrays to record timestamps, one for each document within a Hit */
    timestampsStart: Array<Array<number>>;
    timestampsEnd: Array<Array<number>>;
    timestampsElapsed: Array<number>;

    /* Array of accesses counters, one for each element (questionnaire + documents) */
    elementsAccesses: Array<number>;

    answersPretty: {}[];
    dimensionSelected: {}[];
    queryTotal: {}[];
    responsesRetrievedTotal: {}[];
    responsesSelectedTotal: {}[];
    dimsSelected: {}[];
    query: {}[];
    queryRetrieved: {}[];
    querySelectedUrls: {}[];

    // Flag
    ignoreMsg: boolean; // True: ignora i messaggi in input
    statementProvided: boolean; // True: ho già mostrato all'utente lo statement durante questa fase
    reviewAnswersShown: boolean; // True: la review delle risposte è stata mostrata
    pickReview: boolean; // True: stiamo attendendo input per modificare una dimension
    dimensionReviewPrinted: boolean;
    statementJump: boolean; // True: siamo nella fase di salto degli statement
    waitForUrl: boolean; // True: stiamo attendendo un url
    awaitingAnswer: boolean;
    questionnaireReview: boolean;
    action: string;
    readOnly = true;
    queryIndex: number[];
    sendData = false;
    taskStatus: EnConversationaTaskStatus;
    // Variables
    fixedMessage: string; // Messaggio sempre visibile in alto nel chatbot
    statementAuthor: string;
    statementDate: string;

    answers: [AnswerModel[]] = [[]]; //

    questionnaireAnswers: any[] = [];
    queue: number;
    placeholderInput: string;
    urlPlaceHolder: string;
    tryNumber: number; // Numero di tentativi per completare
    accessesAmount: number[]; //Numero di accessi agli elementi

    private minValue: number = -2; //Valore validazione estremo inferiore
    private maxValue: number = +2; //Valore validazione estremo superirore
    countdownValue: Observable<number>; //Valore del countdown in secondi
    private countdownValueSubject = new BehaviorSubject<number>(0); // Valore del countdown in secondi
    private progress: number; // Percentuale di completamento della barra del timer
    timerIsOver: Observable<boolean>; //Flag per la visualizzazione del countdown scaduto
    private timerIsOverSubject = new BehaviorSubject<boolean>(false);
    private activeInterval: any; //Interval per la gestione del countdown
    public showCountdown = false; //Interval per la gestione del countdown
    private countdownLeftTime = []; //Interval per la gestione del countdown

    //show components flag
    EnInputType = EnConversationalInputType;
    inputComponentToShow: EnConversationalInputType =
        EnConversationalInputType.Text;
    showYNbuttons = false;
    showCMbuttons = false;
    hasDoubleInput = false;
    urlInputValue = "";

    //containers
    categoricalInfo: CategoricalInfo[] = [];
    magnitudeInfo: MagnitudeDimensionInfo = null;
    intervalInfo: IntervalDimensionInfo = null;
    dropdownListOptions: DropdownSelectItem[] = [];

    // Commento finale
    modalCommentContent = "Thanks for finishing the task, this is your token:";

    // Messaggi per l'utente
    instr = [
        "Hello! I'm Fakebot and I'll be helping you complete this task! You can find the <b>instructions</b> in the top left corner of this page, just press the button whenever you need. Nothing will break down, I promise!",
        "Would you like to play a test round?",
    ];
    endOfTaskMessage = [
        "Oh! That was it! Thank you for completing the task! Here's your token: ...",
    ];

    constructor(
        changeDetector: ChangeDetectorRef,
        configService: ConfigService,
        ngxService: NgxUiLoaderService,
        S3Service: S3Service,
        sectionService: SectionService,
        dynamoDBService: DynamoDBService,
        private ngModal: NgbModal
    ) {
        this.changeDetector = changeDetector;
        this.configService = configService;
        this.ngxService = ngxService;
        this.S3Service = S3Service;
        this.sectionService = sectionService;
        this.dynamoDBService = dynamoDBService;
    }

    public operator = {
        name: "Fake News Bot",
        status: "Online",
        avatar: "https://randomuser.me/api/portraits/lego/0.jpg",
    };

    public client = {
        name: "Worker",
        user: "test_user",
        status: "online",
        avatar: `https://storage.proboards.com/6172192/images/gKhXFw_5W0SD4nwuMev1.png`,
    };

    public messages: any[] = [];

    private initializeContainers() {
        this.countdownLeftTime = !!this.task.settings.countdown_time
            ? new Array(this.task.documents.length).fill(0)
            : [];
        this.accessesAmount = new Array(this.task.documents.length).fill(0);
        this.queryIndex = new Array(this.task.documents.length).fill(0);
        this.questionnaireAnswers = new Array(
            this.getNumberOfQuestionnaireQuestions()
        ).fill("");
    }

    private getNumberOfQuestionnaireQuestions(): number {
        let numberOfElements = 0;
        this.task.questionnaires.forEach((el) => {
            numberOfElements = +el.questions.length;
        });
        return numberOfElements;
    }

    private setTaskAnswersContainer() {
        this.answers = [[]];
        for (let i = 0; i < this.task.documents.length; i++) {
            this.answers[i] = [];
            for (let j = 0; j < this.task.dimensionsAmount; j++) {
                this.answers[i].push({ dimensionValue: null });
            }
        }
    }

    ngOnInit() {
        this.task = this.sectionService.task;
        this.typing.nativeElement.style.display = "none";
        // Inizializzo
        this.ignoreMsg = false;
        this.subTaskIndex = 0;
        this.taskIndex = 0;
        this.dimensionReviewPrinted = false;
        this.reviewAnswersShown = false;
        this.pickReview = false;
        this.statementJump = false;
        this.waitForUrl = false;
        this.awaitingAnswer = false;
        this.currentQuestionnaire = 0;
        this.currentQuestion = 0;
        this.taskStatus = EnConversationaTaskStatus.QuestionnairePhase;
        this.questionnaireReview = false;
        this.statementProvided = false;
        this.queue = 0;
        this.placeholderInput = "";
        this.urlPlaceHolder = "";
        this.tryNumber = 1;
        this.dimsSelected = [];
        this.query = [];
        this.queryRetrieved = [];
        this.querySelectedUrls = [];
        this.answersPretty = [];
        this.dimensionSelected = [];
        this.queryTotal = [];
        this.responsesSelectedTotal = [];
        this.responsesRetrievedTotal = [];
        this.action = "Next";

        //Countdown
        this.task.settings.countdown_time = 25;
        this.countdownValue = this.countdownValueSubject.asObservable();
        this.timerIsOver = this.timerIsOverSubject.asObservable();
        this.progress = 0;

        // Stampo le istruzioni iniziali
        this.typingAnimation(this.instr[0]);
        //Dimensionamento dei vettori relativi alle risposte
        this.setTaskAnswersContainer();
        //Dimensionamento dei vettori relativi ai documenti e le dimensioni
        this.initializeContainers();

        //Disabilito il motore di ricerca
        this.emitDisableSearchEngine();

        /* Arrays of start, end and elapsed timestamps are initialized to track how much time the worker spends
         * on each document, including each questionnaire */
        this.loadTimestamps();

        //Check della presenza di questionari nel task
        if (this.questionnaireAnswers.length > 0) {
            this.typingAnimation("First, a few questions about yourself!");
            setTimeout(() => {
                /* The task is now started and the worker is looking at the first questionnaire, so the first start timestamp is saved */
                this.timestampsStart[this.currentQuestionnaire].push(
                    Date.now() / 1000
                );
                this.questionnaireP("0");
            }, 5000);
        } else {
            setTimeout(() => this.skipQuestionnairePhase());
        }

        // PRIMO INVIO DATI ALL'AVVIO
        let data = {};

        let actionInfo = {
            try: this.task.tryCurrent,
            sequence: this.task.sequenceNumber,
            element: "data",
        };
        let taskData = {
            task_id: this.configService.environment.taskName,
            batch_name: this.configService.environment.batchName,
            worker_id: this.worker.identifier,
            unit_id: this.task.unitId,
            token_input: this.task.tokenInput,
            token_output: this.task.tokenOutput,
            tries_amount: this.task.settings.allowed_tries,
            questionnaire_amount: this.task.questionnaireAmount,
            questionnaire_amount_start: this.task.questionnaireAmountStart,
            questionnaire_amount_end: this.task.questionnaireAmountEnd,
            documents_amount: this.task.documentsAmount,
            dimensions_amount: this.task.dimensionsAmount,
        };

        data["info"] = actionInfo;
        /* General info about task */
        data["task"] = taskData;
        /* The answers of the current worker to the questionnaire */
        data["questionnaires"] = this.task.questionnaires;
        /* The parsed document contained in current worker's hit */
        data["documents"] = this.task.documents;
        /* The dimensions of the answers of each worker */
        data["dimensions"] = this.task.dimensions;
        /* General info about worker */
        data["worker"] = this.worker;
        this.task.sequenceNumber += 1;
    }

    //Creazione del countdown
    private setCountdown() {
        this.showCountdown = true;
        this.countdownValueSubject.next(this.task.settings.countdown_time);
        this.timerIsOverSubject.next(false);
        this.progress = this.task.settings.countdown_time / 100;
        this.progressBar.nativeElement.style.width =
            this.progress.toString() + "%";

        this.activeInterval = setInterval(() => {
            let countdownValue = this.countdownValueSubject.value - 1;
            this.countdownValueSubject.next(countdownValue);
            if (countdownValue == 0) {
                this.progressBar.nativeElement.style.width = "100%";
                this.timerIsOverSubject.next(true);
                this.storeCountdownData();
                return clearInterval(this.activeInterval);
            } else {
                this.progressBar.nativeElement.display = "block";
                this.progress =
                    100 -
                    (countdownValue * 100) / this.task.settings.countdown_time;
                if (this.progress > 0 && this.progress < 100) {
                    this.progressBar.nativeElement.style.width =
                        this.progress.toString() + "%";
                }
            }
        }, 1000);
    }

    // Core
    public sendMessage({ message }) {
        if (this.hasDoubleInput) {
            this.emitGetUrlValue();
        }
        // Se il messaggio è vuoto, ignoro
        if (
            this.inputComponentToShow != EnConversationalInputType.Button &&
            this.inputComponentToShow != EnConversationalInputType.Dropdown &&
            message.trim() === ""
        ) {
            return;
        }
        // Mostro il messaggio in chat
        if (this.inputComponentToShow == EnConversationalInputType.Dropdown) {
            message = message.label;
            if (this.hasDoubleInput) {
                this.addMessageClient(
                    this.client,
                    { url: this.urlInputValue, value: message },
                    "sent",
                    true
                );
            } else {
                this.addMessageClient(this.client, message, "sent");
            }
        } else {
            if (this.hasDoubleInput) {
                this.addMessageClient(
                    this.client,
                    { url: this.urlInputValue, value: message },
                    "sent",
                    true
                );
            } else {
                this.addMessageClient(this.client, message, "sent");
            }
        }

        // Se il messaggio è da ignorare, lo ignoro
        if (this.ignoreMsg) {
            return;
        }
        // END TASK PHASE
        if (this.taskStatus === EnConversationaTaskStatus.EndPhase) {
            this.endP(message);
            return;
        }
        //QUESTIONNAIRE PHASE
        if (this.taskStatus === EnConversationaTaskStatus.QuestionnairePhase) {
            this.questionnaireP(message);
        }
        //INSTRUCTION PHASE
        if (this.taskStatus === EnConversationaTaskStatus.InstructionPhase) {
            this.instructionP();
        }
        //TASK PHASE
        if (this.taskStatus === EnConversationaTaskStatus.TaskPhase) {
            this.taskP(message);
        }
        //REVIEW PHASE
        if (this.taskStatus === EnConversationaTaskStatus.ReviewPhase) {
            this.reviewP(message);
        }
    }

    // Fase dei questionari
    private questionnaireP(message) {
        if (
            this.task.questionnaires[this.currentQuestionnaire].type ==
            "standard"
        ) {
            if (this.awaitingAnswer) {
                this.questionnaireAnswers[this.currentQuestion] = message;
                this.randomMessage();
                this.currentQuestion += 1;
                this.awaitingAnswer = false;
            }
            if (
                this.currentQuestion >=
                this.task.questionnaires[this.currentQuestionnaire].questions
                    .length
            ) {
                this.timestampsEnd[this.currentQuestionnaire].push(
                    Date.now() / 1000
                );
                //Calcolo tempo trascorso tra il completamento di due questionari

                this.timestampsElapsed[this.currentQuestionnaire] =
                    this.timestampsEnd[this.currentQuestionnaire][0] -
                    this.timestampsStart[this.currentQuestionnaire][0];

                this.uploadQuestionnaireData(this.currentQuestionnaire);
                this.currentQuestionnaire += 1;
                this.timestampsStart[this.currentQuestionnaire].push(
                    Date.now() / 1000
                );
            } else {
                this.readOnly = true;
                this.printQuestion();
                this.typingAnimation(this.createQuestionnaireAnswers());

                setTimeout(() => {
                    this.generateQuestionnaireAnswers();
                    this.readOnly = false;
                    this.inputComponentToShow =
                        EnConversationalInputType.Dropdown;
                }, 850);

                this.awaitingAnswer = true;
                return;
            }
            if (this.checkIfQuestionnaireIsFinished()) return;
        }
        if (
            this.task.questionnaires[this.currentQuestionnaire].type == "crt" ||
            this.task.questionnaires[this.currentQuestionnaire].type == "likert"
        ) {
            this.inputComponentToShow = EnConversationalInputType.Number;
            this.inputComponentToShow;
            if (this.awaitingAnswer) {
                if (!ChatHelper.validMsg(message, 1, 100)) {
                    this.typingAnimation(
                        "Please type a integer number between 1 and 100"
                    );
                    return;
                }

                this.questionnaireAnswers[this.currentQuestion] = message;
                this.currentQuestion += 1;
                this.randomMessage();

                this.currentQuestionnaire += 1;
                this.awaitingAnswer = false;

                if (this.checkIfQuestionnaireIsFinished()) return;
            }
            this.typingAnimation(
                this.task.questionnaires[this.currentQuestionnaire].questions[
                    this.currentQuestion %
                        this.task.questionnaires[this.currentQuestionnaire]
                            .questions.length
                ].text
            );

            this.awaitingAnswer = true;
        }
    }

    // Fase di istruzioni
    private instructionP() {
        this.taskStatus = EnConversationaTaskStatus.TaskPhase; // Passiamo alla task phase
        this.ignoreMsg = true;
        this.fixedMessage = null;
        this.typingAnimation(
            "I'll now show you some statements and for each one I'll ask you some questions. Please use the search bar on the left to search for info about those statement and answer my questions"
        );
        this.taskP("p");
    }

    // Fase di task
    private taskP(message) {
        if (this.inputComponentToShow == EnConversationalInputType.Dropdown) {
            message = this.getCategoricalAnswerValue(message);
            this.inputComponentToShow = EnConversationalInputType.Text;
        }
        //E' l'ultima dimensione dello statement?
        if (
            this.subTaskIndex >= this.task.dimensionsAmount &&
            this.getAnswerValidity(
                this.subTaskIndex - 1,
                message,
                this.urlInputValue
            )
        ) {
            //Stop del interval
            if (this.task.settings.countdown_time) {
                this.countdownLeftTime[this.taskIndex] = this.countdownValue;
                this.resetCountdown();
            }
            //Salvo il tempo di fine
            this.timestampsEnd[this.taskIndex].push(Date.now() / 1000);

            const subtaskIndex = this.subTaskIndex - 1;
            if (this.hasDoubleInput) {
                this.answers[this.taskIndex][subtaskIndex] = {
                    dimensionValue: message,
                    urlValue: this.urlInputValue,
                };
                this.hasDoubleInput = false;
            } else if (this.waitForUrl) {
                this.answers[this.taskIndex][subtaskIndex].dimensionValue =
                    message;
            } else {
                this.answers[this.taskIndex][subtaskIndex].dimensionValue =
                    message;
            }

            this.statementProvided = false;
            this.reviewAnswersShown = false;
            this.taskStatus = EnConversationaTaskStatus.ReviewPhase;

            let dimSel = {};
            dimSel["document"] = this.taskIndex;
            dimSel["dimension"] = subtaskIndex;
            dimSel["index"] = this.taskIndex;
            dimSel["timestamp"] = Date.now() / 1000;
            dimSel["value"] =
                this.answers[this.taskIndex][subtaskIndex].dimensionValue;
            dimSel["url"] = this.answers[this.taskIndex][subtaskIndex].urlValue;

            this.dimsSelected.push(dimSel);
            this.uploadDocumentData();

            this.reviewP(message);
            return;
        } // E' una dimensione che richiede solo un URL
        else if (this.waitForUrl) {
            if (!ChatHelper.urlValid(message)) {
                this.typingAnimation(
                    "Please type or select a valid url, try using the search bar on the right!"
                );
                return;
            }
            this.answers[this.taskIndex][this.subTaskIndex - 1].urlValue =
                message;
            this.cleanUserInput();
            this.ignoreMsg = true;
        }
        //E' una dimensione con doppio input
        else if (this.hasDoubleInput) {
            if (
                !this.getAnswerValidity(
                    this.subTaskIndex - 1,
                    message,
                    this.urlInputValue
                )
            ) {
                this.typingAnimation(
                    "Check your answers, please type or select a valid url,you can use the search bar on the right!"
                );
                return;
            }

            this.hasDoubleInput = false;
            this.answers[this.taskIndex][this.subTaskIndex - 1].urlValue =
                this.urlInputValue;
            this.answers[this.taskIndex][this.subTaskIndex - 1].dimensionValue =
                message;
            this.cleanUserInput();
            this.ignoreMsg = true;
        } else if (
            message != "startTask" &&
            !ChatHelper.validMsg(message, this.minValue, this.maxValue) &&
            !this.ignoreMsg &&
            this.inputComponentToShow != EnConversationalInputType.Text
        ) {
            let messageToSend = "";
            if (this.inputComponentToShow == EnConversationalInputType.Number) {
                messageToSend = `Please type a integer number higher than ${this.minValue} `;
            } else {
                messageToSend = `Please type a integer number between ${this.minValue} and ${this.maxValue}`;
            }
            this.typingAnimation(messageToSend);

            return;
        }
        //E' una dimensione testuale libera
        else if (
            !this.ignoreMsg &&
            message != "startTask" &&
            this.inputComponentToShow == EnConversationalInputType.Text
        ) {
            if (!!message.trim()) {
                this.answers[this.taskIndex][
                    this.subTaskIndex - 1
                ].dimensionValue = message;
            } else {
                this.typingAnimation("Please insert a text...");
                return;
            }
        }
        if (!this.ignoreMsg && message != "startTask") {
            this.ignoreMsg = true;
            this.cleanUserInput();

            const subtaskIndex = this.subTaskIndex - 1;
            this.answers[this.taskIndex][subtaskIndex].dimensionValue = message;
            let dimSel = {};
            dimSel["document"] = this.taskIndex;
            dimSel["dimension"] = subtaskIndex;
            dimSel["index"] = this.taskIndex;
            dimSel["timestamp"] = Date.now() / 1000;
            dimSel["value"] = message;
            this.dimsSelected.push(dimSel);

            this.randomMessage();
        } else if (message == "startTask") {
            this.randomMessage();
        }

        //Visualizzazione dello statement
        if (
            this.fixedMessage == null ||
            this.fixedMessage == undefined ||
            this.fixedMessage == ""
        ) {
            this.printStatement();
        }
        //Visualizzazione della dimensione
        if (!!this.fixedMessage) {
            if (
                !!this.task.settings.countdown_time &&
                this.taskStatus == EnConversationaTaskStatus.TaskPhase &&
                this.subTaskIndex == 0
            ) {
                this.setCountdown();
            }
            this.printDimension(this.taskIndex, this.subTaskIndex);
            this.selectDimensionToGenerate(this.subTaskIndex);
            this.subTaskIndex++;
        }

        this.ignoreMsg = false;
    }

    // Fase di review
    private reviewP(message: string) {
        if (this.inputComponentToShow == EnConversationalInputType.Dropdown) {
            message = this.getDimensionAnswerValue(message);
        }
        if (this.questionnaireReview) {
            if (this.pickReview) {
                //E' in attesa della risposta da parte dell'utente
                if (this.awaitingAnswer) {
                    if (
                        this.task.questionnaires[this.currentQuestionnaire]
                            .type == "standard"
                    ) {
                        this.questionnaireAnswers[this.currentQuestion] =
                            message;
                    } else if (
                        this.task.questionnaires[this.currentQuestionnaire]
                            .type == "crt" ||
                        this.task.questionnaires[this.currentQuestionnaire]
                            .type == "likert"
                    ) {
                        if (!ChatHelper.validMsg(message, 1, 100)) {
                            this.typingAnimation(
                                "Please type a integer number between 1 and 100"
                            );
                            return;
                        }
                    }
                    this.questionnaireAnswers[this.currentQuestion] = message;
                    this.reviewAnswersShown = false;
                    this.pickReview = false;
                    this.awaitingAnswer = false;
                } else {
                    //Si sta selezionando la domanda da revisionare
                    this.currentQuestion = +message;

                    let previousQuestionIndex = this.currentQuestion - 1;
                    // Viene calcolato il questionario di appartenenza della domanda e il suo relativo indice
                    let questionnaireToCheck = 0;
                    while (
                        this.currentQuestion >
                        this.task.questionnaires[questionnaireToCheck].questions
                            .length
                    ) {
                        this.currentQuestion =
                            this.currentQuestion -
                            this.task.questionnaires[questionnaireToCheck]
                                .questions.length;
                        if (this.currentQuestion > 0) questionnaireToCheck++;
                    }
                    this.currentQuestionnaire = questionnaireToCheck;
                    this.currentQuestion--;
                    this.printQuestion();
                    if (
                        this.task.questionnaires[this.currentQuestionnaire]
                            .type == "standard"
                    ) {
                        this.typingAnimation(this.createQuestionnaireAnswers());
                        this.generateQuestionnaireAnswers();
                        this.currentQuestion = previousQuestionIndex;
                        this.readOnly = false;
                        this.inputComponentToShow ==
                            EnConversationalInputType.Dropdown;

                        this.awaitingAnswer = true;
                        return;
                    } else if (
                        this.task.questionnaires[this.currentQuestionnaire]
                            .type == "crt" ||
                        this.task.questionnaires[this.currentQuestionnaire]
                            .type == "likert"
                    ) {
                        this.currentQuestion = previousQuestionIndex;
                        this.inputComponentToShow =
                            EnConversationalInputType.Number;
                        this.inputComponentToShow;
                        this.awaitingAnswer = true;
                        return;
                    }
                    this.awaitingAnswer = true;
                    this.showCMbuttons = false;
                    return;
                }
            }
            if (!this.reviewAnswersShown) {
                this.cleanUserInput();

                this.typingAnimation("Let's review your answers!");
                this.typingAnimation(
                    this.createQuestionnaireRecap() +
                        "<br>Confirm your answers?"
                );
                this.readOnly = false;
                this.reviewAnswersShown = true;
                this.showCMbuttons = true;
                return;
            }
            //Confermo le risposte del questionario
            if (message.trim().toLowerCase() === "confirm") {
                this.timestampsEnd[this.currentQuestionnaire][0] =
                    Date.now() / 1000;
                this.inputComponentToShow = EnConversationalInputType.Text;
                this.showCMbuttons = false;
                this.questionnaireReview = false;

                //Fine revisione questionario
                this.timestampsElapsed[this.currentQuestionnaire] =
                    this.timestampsEnd[this.currentQuestionnaire][0] -
                    this.timestampsStart[this.currentQuestionnaire][0];

                this.uploadQuestionnaireData(this.currentQuestionnaire - 1);
                // Passo al prossimo statement, resetto
                this.randomMessage();

                this.taskIndex = 0;
                this.subTaskIndex = 0;
                this.reviewAnswersShown = false;
                this.ignoreMsg = true;
                this.taskStatus = EnConversationaTaskStatus.InstructionPhase;
                this.awaitingAnswer = false;

                this.pickReview = false;
                this.instructionP();

                return;
            } else if (message.trim().toLowerCase() === "modify") {
                this.showCMbuttons = false;
                this.action = "Back";

                this.typingAnimation("Which one would you like to modify?");
                this.generateRevisionData();
                this.pickReview = true;
                this.timestampsStart[this.currentQuestionnaire][0] =
                    Date.now() / 1000;
                return;
            } else {
                //La risposta fornita non è valida, si rimane in attesa
                return;
            }
        }
        // Sto modificando una dimensione
        if (this.pickReview) {
            // La dimensione è visualizzata
            if (this.dimensionReviewPrinted) {
                if (this.hasDoubleInput) {
                    if (
                        !this.getAnswerValidity(
                            this.subTaskIndex,
                            message,
                            this.urlInputValue
                        )
                    ) {
                        this.typingAnimation(
                            "Please check your answers, and check if you typed a valid url, try using the search bar on the right!"
                        );

                        return;
                    }
                    this.inputComponentToShow == EnConversationalInputType.Text;
                    this.hasDoubleInput = false;
                    this.answers[this.taskIndex][this.subTaskIndex] = {
                        dimensionValue: message,
                        urlValue: this.urlInputValue,
                    };
                } else if (this.waitForUrl) {
                    if (!ChatHelper.urlValid(message)) {
                        this.typingAnimation(
                            "Please type a valid url, try using the search bar on the right!"
                        );
                        return;
                    }
                    this.waitForUrl = false;
                    this.answers[this.taskIndex][this.subTaskIndex].urlValue =
                        message;
                } else if (
                    this.inputComponentToShow ==
                    EnConversationalInputType.Dropdown
                ) {
                    message = this.getCategoricalAnswerValue(message);
                    this.answers[this.taskIndex][
                        this.subTaskIndex
                    ].dimensionValue = message;
                } //Testo libero
                else {
                    this.answers[this.taskIndex][
                        this.subTaskIndex
                    ].dimensionValue = message;
                }

                if (
                    !ChatHelper.validMsg(message, this.minValue, this.maxValue)
                ) {
                    let messageToSend = "";
                    if (!this.inputComponentToShow) {
                        messageToSend = `Please type a integer number between ${this.minValue} and ${this.maxValue}`;
                    } else {
                        messageToSend = `Please type a integer number higher than 0 `;
                    }
                    this.typingAnimation(messageToSend);
                    return;
                } else {
                    if (!!message.trim()) {
                        this.answers[this.taskIndex][
                            this.subTaskIndex
                        ].dimensionValue = message;
                    } else {
                        this.typingAnimation("Please insert a text...");
                        return;
                    }
                }
            } else {
                //Faccio scegliere quale dimensione visualizzare
                if (
                    !ChatHelper.validMsg(message, 1, this.task.dimensionsAmount)
                ) {
                    let messageToSend = `Please type a integer number between 1 and ${this.task.dimensionsAmount}`;
                    this.typingAnimation(messageToSend);
                    return;
                }
                this.subTaskIndex = +message;
                if (this.subTaskIndex > 0) this.subTaskIndex--;

                //Visualizzazione della dimensione richiesta e relativi dati
                this.printDimension(this.taskIndex, this.subTaskIndex);
                this.selectDimensionToGenerate(this.subTaskIndex);
                this.dimensionReviewPrinted = true;
                return;
            }
            this.cleanUserInput();
            let dimSel = {};
            dimSel["document"] = this.taskIndex;
            dimSel["dimension"] = this.subTaskIndex;
            dimSel["index"] = this.taskIndex;
            dimSel["timestamp"] = Date.now() / 1000;
            dimSel["value"] = this.answers[this.taskIndex][this.subTaskIndex];
            this.dimsSelected.push(dimSel);

            // Reset della fase di revisione
            this.reviewAnswersShown = false;
            this.pickReview = false;
            this.uploadDocumentData();
        }

        // Ripeto questa fase finchè non ricevo un Confirm
        if (!this.reviewAnswersShown) {
            this.cleanUserInput();
            this.typingAnimation("Let's review your answers!");
            this.typingAnimation(
                this.createDocumentRecap(this.taskIndex) +
                    "<br>Confirm your answers?"
            );
            this.showCMbuttons = true;
            this.reviewAnswersShown = true;
            return;
        } //Conferma le risposte dell'assignment
        if (message.trim().toLowerCase() === "confirm") {
            this.inputComponentToShow = EnConversationalInputType.Text;
            this.showCMbuttons = false;
            document.getElementById(this.taskIndex.toString()).className =
                "dot-completed";
            // Se era l'ultimo statement, passo alla fase finale
            if (
                this.task.hit.documents.length - 1 <= this.taskIndex ||
                this.statementJump
            ) {
                this.statementJump = false;
                this.taskStatus = EnConversationaTaskStatus.EndPhase;
                this.reviewAnswersShown = false;
                this.typingAnimation(
                    "OK! Would you like to jump to a specific statement?"
                );
                this.cleanUserInput();
                this.readOnly = false;
                this.showYNbuttons = true;
                this.timestampsEnd[
                    this.currentQuestionnaire + this.taskIndex
                ].push(Date.now() / 1000);
                this.timestampsElapsed[
                    this.currentQuestionnaire + this.taskIndex
                ] +=
                    this.timestampsEnd[
                        this.currentQuestionnaire + this.taskIndex
                    ][
                        this.timestampsEnd[
                            this.currentQuestionnaire + this.taskIndex
                        ].length - 1
                    ] -
                    this.timestampsStart[
                        this.currentQuestionnaire + this.taskIndex
                    ][
                        this.timestampsEnd[
                            this.currentQuestionnaire + this.taskIndex
                        ].length - 1
                    ];

                return;
            } else {
                this.randomMessage();
                this.taskStatus = EnConversationaTaskStatus.TaskPhase;
                this.taskIndex++;
                this.reviewAnswersShown = false;
                this.ignoreMsg = true;
                this.subTaskIndex = 0;
                this.fixedMessage = null;
                this.taskP(message);
            }
        } else if (message.trim().toLowerCase() === "modify") {
            this.showCMbuttons = false;
            this.typingAnimation("Which dimension would you like to change?");
            this.cleanUserInput();
            this.generateRevisionData();
            this.readOnly = false;
            this.pickReview = true; // Passo alla fase di modifica
            this.dimensionReviewPrinted = false; // Reset
            return;
        } else {
            return;
        }
    }

    // Fase di fine task
    private endP(message) {
        if (this.statementJump) {
            this.getDimensionAnswerValue(message);
            this.taskIndex = this.getFinalRevisionAnswerValue(message);
            this.subTaskIndex = 0;
            this.printStatement();
            this.taskStatus = EnConversationaTaskStatus.ReviewPhase;
            if (this.task.settings.countdown_time) {
                this.resetCountdown();
            }
            this.reviewAnswersShown = false;
            this.reviewP(message);
            // print answers e avvia come la review
        } else {
            if (message.trim().toLowerCase() === "yes") {
                this.action = "Back";
                this.typingAnimation(
                    this.createStatementString() +
                        "Which statement would you like to jump to?"
                );
                this.showYNbuttons = false;
                this.inputComponentToShow = EnConversationalInputType.Dropdown;
                this.generateFinalStatementRecapData();
                this.statementJump = true;
            } else if (message.trim().toLowerCase() === "no") {
                this.action = "Finish";
                this.task.sequenceNumber += 1;
                // INVIO DATI COL CONTROLLO QUALITA
                let validTry = this.validateTask();
                this.taskQualityCheck();

                let data = {};
                let actionInfoCheck = {
                    try: this.task.tryCurrent,
                    sequence: this.task.sequenceNumber,
                    element: "checks",
                };

                data["info"] = actionInfoCheck;

                this.task.sequenceNumber += 1;
                if (!validTry) {
                    this.typingAnimation("Failure! Let's try again");
                    if (this.tryNumber >= 3) {
                        this.typingAnimation(
                            "Sorry, you are not eligible for completing this task. Please close this page."
                        );
                        this.ignoreMsg = true;
                        return;
                    }
                    this.tryNumber += 1;
                    this.taskStatus = EnConversationaTaskStatus.TaskPhase;
                    // Reinizializzo
                    for (let i = 0; i < this.task.documents.length; i++) {
                        document.getElementById(i.toString()).className =
                            "dot-to-complete";
                    }
                    this.cleanUserInput();
                    this.typing.nativeElement.style.display = "none";
                    this.showYNbuttons = false;
                    this.ignoreMsg = true;
                    this.subTaskIndex = 0;
                    this.taskIndex = 0;
                    this.dimensionReviewPrinted = false;
                    this.reviewAnswersShown = false;
                    this.pickReview = false;
                    this.statementJump = false;
                    this.awaitingAnswer = false;
                    this.statementProvided = false;
                    this.taskP({ value: "startTask" });
                    return;
                }
                //Messaggio finale
                this.typingAnimation(this.endOfTaskMessage[0]);
                setTimeout(() => {
                    //Richiesta commento
                    const modalRef = this.ngModal.open(
                        ChatCommentModalComponent,
                        {
                            size: "md",
                        }
                    );
                    modalRef.componentInstance.outputToken =
                        this.task.tokenOutput;
                    modalRef.componentInstance.message =
                        this.modalCommentContent;

                    modalRef.result.then((comment) => {
                        this.buildCommentPayload(comment);
                        this.showYNbuttons = false;
                        this.typingAnimation("You may now close the page!");
                    });
                }, 3000);
            } else {
                return;
            }
        }
    }

    private skipQuestionnairePhase() {
        this.typingAnimation("Let's start, with the activity!");
        this.taskStatus = EnConversationaTaskStatus.TaskPhase;
        setTimeout(() => this.taskP("startTask"), 3000);
    }

    //Controlla se il questionario è finito e avvia la fase di revisione del questionario
    private checkIfQuestionnaireIsFinished() {
        let isFinished = false;
        if (this.currentQuestionnaire >= this.task.questionnaires.length) {
            isFinished = true;
            this.readOnly = true;
            this.taskStatus = EnConversationaTaskStatus.ReviewPhase;
            this.questionnaireReview = true;
        }
        return isFinished;
    }

    private emitGetUrlValue() {
        this.readUrlValue.emit();
    }

    public updateUrlValue($event) {
        this.urlInputValue = $event;
    }

    //Metodi di supporto per il Search Engine
    private emitResetSearchEngineState() {
        this.resetSearchEngine.emit();
    }
    private emitDisableSearchEngine() {
        this.disableSearchEngine.emit(true);
    }
    private emitEnableSearchEngine() {
        this.disableSearchEngine.emit(false);
    }
    private cleanUserInput() {
        this.urlPlaceHolder = "";
        this.placeholderInput = "";
        this.inputComponentToShow = EnConversationalInputType.Text;
        this.waitForUrl = false;
        this.emitDisableSearchEngine();
        this.emitResetSearchEngineState();
    }

    //Salvataggio delle row selezionate
    public getUrl(row) {
        if (this.hasDoubleInput) {
            this.urlPlaceHolder = row.url;
            this.emitGetUrlValue();
        } else {
            this.placeholderInput = row.url;
        }
        let q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.subTaskIndex;
        q["query"] = this.queryRetrieved.length;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = Date.now() / 1000;
        q["response"] = row;
        this.querySelectedUrls.push(q);
        return;
    }

    public storeSearchEngineRetrievedResponse(resp) {
        let q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.subTaskIndex;
        q["query"] = this.queryRetrieved.length;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = Date.now() / 1000;
        q["response"] = resp;
        this.queryRetrieved.push(q);
    }

    public storeSearchEngineUserQuery(text) {
        this.placeholderInput = "";
        this.readOnly = false;
        let q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.subTaskIndex;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = Date.now() / 1000;
        q["text"] = text;
        this.query.push(q);
        this.queryIndex[this.taskIndex] += 1;
    }

    /* -- Metodi per la gestione di INPUT & OUTPUT -- */

    // Aggiunta di un messaggio scritto dall'utente a messages
    public addMessageClient(
        from: { name: string; status: string; avatar: string; user?: string },
        text: any,
        type: "received" | "sent",
        hasDoubleInput = false
    ) {
        if (hasDoubleInput) {
            text =
                "<b>Url:</b> " +
                text.url +
                "<br>" +
                "<b>Answer:</b> " +
                text.value +
                "<br>";
        }
        // unshift aggiunge elementi all'inizio del vettore
        this.messages.unshift({
            from,
            text,
            type,
            date: new Date().getTime(),
        });
        this.changeDetector.detectChanges();
        this.scrollToBottom();
    }
    // Aggiunta di un elemento a messages
    public addMessage(
        from: { name: string; status: string; avatar: string; user?: string },
        text: any,
        type: "received" | "sent"
    ) {
        // unshift aggiunge elementi all'inizio del vettore
        this.messages.unshift({
            from,
            text,
            type,
            date: new Date().getTime(),
        });
        this.queue -= 1;
        if (this.queue == 0) {
            this.typing.nativeElement.style.display = "none"; // Tolgo l'animazione di scrittura
            this.ignoreMsg = false;
        }
        this.changeDetector.detectChanges();
        this.scrollToBottom();
    }
    // Stampa il messaggio inviato dal bot dopo un delay
    public typingAnimation(message: string) {
        this.typing.nativeElement.style.display = "block"; // Mostro l'animazione di scrittura
        this.queue += 1;
        this.ignoreMsg = true; // Ignoro i messaggi in arrivo mentre scrivo
        setTimeout(
            () => this.addMessage(this.operator, message, "received"),
            this.queue * 800
        ); // modifica speed
        this.changeDetector.detectChanges();
        this.scrollToBottom();
    }
    //Fa scrollare la chat infondo
    public scrollToBottom() {
        if (this.bottom !== undefined) {
            this.bottom.nativeElement.scrollIntoView();
        }
    }

    // Intercetta i messaggi dei pulsanti
    public buttonInput(message: string) {
        this.sendMessage({ message });
    }

    // Invio un messaggio random
    public randomMessage() {
        this.typingAnimation(getRandomMessage());
    }

    //Stampa della domanda nella chat
    private printQuestion() {
        let q =
            this.task.questionnaires[this.currentQuestionnaire].questions[
                this.currentQuestion
            ].text;
        this.typingAnimation(q);
        return;
    }

    // Stampa lo statement corrente e lo fissa nella chat
    private printStatement() {
        this.accessesAmount[this.taskIndex] += 1;

        document.getElementById(this.taskIndex.toString()).className =
            "dot-in-progress";
        let messageToSend =
            "Statement: <b>" +
            this.task.hit.documents[this.taskIndex]["statement_text"] +
            "</b> - ";
        if (!!this.task.hit.documents[this.taskIndex]["speaker_name"])
            messageToSend +=
                this.task.hit.documents[this.taskIndex]["speaker_name"];
        if (!!this.task.hit.documents[this.taskIndex]["statement_date"])
            messageToSend +=
                " " + this.task.hit.documents[this.taskIndex]["statement_date"];
        this.typingAnimation(messageToSend);
        //Composizione messaggio fissato
        if (!!this.fixedMessage) {
        } else {
            if (!!this.task.hit.documents[this.taskIndex]["statement_text"])
                this.fixedMessage =
                    this.task.hit.documents[this.taskIndex]["statement_text"];

            if (!!this.task.hit.documents[this.taskIndex]["speaker_name"])
                this.statementAuthor =
                    this.task.hit.documents[this.taskIndex]["speaker_name"];

            if (!!this.task.hit.documents[this.taskIndex]["statement_date"])
                this.statementDate =
                    this.task.hit.documents[this.taskIndex]["statement_date"];
        }
    }

    // Stampa la dimensione corrente
    private printDimension(taskIndex: number, dimensionIndex: number) {
        let out = "";

        if (this.task.dimensions[dimensionIndex].name_pretty) {
            out =
                "Please rate the <b>" +
                this.task.dimensions[dimensionIndex].name_pretty +
                "</b> of the statement.<br>";
            if (!!this.task.dimensions[dimensionIndex].description)
                out +=
                    "<b>" +
                    this.task.dimensions[dimensionIndex].name_pretty +
                    "</b>: " +
                    this.task.dimensions[dimensionIndex].description;
        } else {
            out =
                "Please rate the <b>" +
                this.task.dimensions[dimensionIndex].name +
                "</b> of the statement.<br>";
            if (!!this.task.dimensions[dimensionIndex].description)
                out +=
                    "<b>" +
                    this.task.dimensions[dimensionIndex].name_pretty +
                    "</b>: " +
                    this.task.dimensions[dimensionIndex].description;
        }
        if (!!this.answers[taskIndex][dimensionIndex].dimensionValue) {
            out += "<br>You previously answered<br>";
            if (!!this.task.dimensions[dimensionIndex].url) {
                out +=
                    "Url: <b>" +
                    this.answers[taskIndex][dimensionIndex].urlValue +
                    "</b><br>";
            }
            if (
                this.task.dimensions[dimensionIndex].scale.type == "categorical"
            ) {
                out +=
                    "<br>Dimension value: <b>" +
                    this.getCategoricalAnswerLabel(
                        dimensionIndex,
                        this.answers[taskIndex][dimensionIndex].dimensionValue
                    ) +
                    "</b>.";
            } else {
                out +=
                    "<br>Dimension value: <b>" +
                    this.answers[taskIndex][dimensionIndex].dimensionValue +
                    "</b>.";
            }
        }
        this.typingAnimation(out);
    }

    // Creazione del testo relativo alle risposte fornite riguardo allo statement attuale
    private createDocumentRecap(taskIndex) {
        let recap = "";
        for (let i = 0; i < this.task.dimensionsAmount; i++) {
            let scaleType = null;
            //Dimensioni con doppio input
            if (
                this.task.dimensions[i].scale &&
                !!this.task.dimensions[i].url
            ) {
                scaleType = this.task.dimensions[i].scale.type;
                recap +=
                    i +
                    1 +
                    ".<b> URL</b>: " +
                    this.answers[taskIndex][i].urlValue +
                    "<br>";
                switch (scaleType) {
                    case "categorical":
                        if (this.task.dimensions[i].name_pretty) {
                            recap +=
                                "<b>" +
                                this.task.dimensions[i].name_pretty +
                                "</b>: ";
                        }
                        recap +=
                            this.getCategoricalAnswerLabel(
                                i,
                                this.answers[taskIndex][
                                    i
                                ].dimensionValue.toString()
                            ) + "<br>";

                        break;
                    case "magnitude_estimation":
                        if (this.task.dimensions[i].name_pretty) {
                            recap +=
                                "<b>" +
                                this.task.dimensions[i].name_pretty +
                                "</b>: ";
                        }
                        recap +=
                            this.answers[taskIndex][i].dimensionValue + "<br>";
                        break;
                    case "interval":
                        if (this.task.dimensions[i].name_pretty) {
                            recap +=
                                "<b>" +
                                this.task.dimensions[i].name_pretty +
                                "</b>: ";
                        }
                        recap +=
                            this.answers[taskIndex][i].dimensionValue + " <br>";
                        break;
                    default:
                        console.warn("Casistica non gestita");
                        break;
                }
            }
            // Dimensioni con singolo input
            else {
                if (
                    !this.task.dimensions[i].scale &&
                    !!this.task.dimensions[i].url
                ) {
                    scaleType = "url";
                } else if (
                    !this.task.dimensions[i].scale &&
                    !this.task.dimensions[i].url
                ) {
                    scaleType = "textual";
                } else {
                    scaleType = this.task.dimensions[i].scale.type;
                }
                switch (scaleType) {
                    case "url":
                        recap +=
                            i +
                            1 +
                            ".<b> URL</b>: " +
                            this.answers[taskIndex][i].urlValue +
                            "<br>";
                        break;
                    case "categorical":
                        if (this.task.dimensions[i].name_pretty) {
                            recap +=
                                i +
                                1 +
                                ". <b>" +
                                this.task.dimensions[i].name_pretty +
                                "</b>: " +
                                this.getCategoricalAnswerLabel(
                                    i,
                                    this.answers[taskIndex][i].toString()
                                ) +
                                "<br>";
                        }
                        break;
                    case "magnitude_estimation":
                        if (this.task.dimensions[i].name_pretty) {
                            recap +=
                                i +
                                1 +
                                ". <b>" +
                                this.task.dimensions[i].name_pretty +
                                "</b>: " +
                                this.answers[taskIndex][i].dimensionValue +
                                "<br>";
                        }
                        break;
                    case "interval":
                        if (this.task.dimensions[i].name_pretty) {
                            recap +=
                                i +
                                1 +
                                ". <b>" +
                                this.task.dimensions[i].name_pretty +
                                "</b>: " +
                                this.answers[taskIndex][i].dimensionValue +
                                " <br>";
                        }
                        break;
                    case "textual":
                        recap +=
                            i +
                            1 +
                            ".<b>" +
                            this.task.dimensions[i].name_pretty +
                            " </b>: " +
                            this.answers[taskIndex][i].dimensionValue +
                            "<br>";
                        break;
                    default:
                        console.warn("Casistica non gestita");
                        break;
                }
            }
        }
        return recap;
    }

    // Creo una stringa con tutti gli statement
    private createStatementString() {
        let statements = "";
        for (let i = 0; i < this.task.hit.documents.length; i++) {
            statements +=
                "Statement " +
                (i + 1) +
                ": <b>" +
                this.task.hit.documents[i]["statement_text"] +
                "</b> <br> - " +
                this.task.hit.documents[i]["speaker_name"] +
                ", ";
            if (!!this.task.hit.documents[i]["statement_date"])
                statements += this.task.hit.documents[i]["statement_date"];
        }
        statements += "<br><br>";
        return statements;
    }

    //Creazione del testo della domanda e delle risposte possibili
    private createQuestionnaireAnswers() {
        let l =
            this.task.questionnaires[this.currentQuestionnaire].questions[
                this.currentQuestion
            ].answers;
        let recap = "";
        for (let i = 0; i < l.length; i++) {
            recap += i + 1 + ". <b>" + l[i] + "</b><br><br>";
        }
        recap += "Please select the correct answer";
        return recap;
    }

    //Creazione testo di riepilogo del questionario
    private createQuestionnaireRecap() {
        let recap = "";
        let questionIndex = 1;
        this.task.questionnaires.forEach((questionnaire) => {
            for (let i = 0; i < questionnaire.questions.length; i++) {
                if (questionnaire.type == "standard") {
                    recap +=
                        questionIndex +
                        ". Question: <b>" +
                        questionnaire.questions[i].text +
                        "</b><br>Answer:<b> " +
                        this.questionnaireAnswers[i] +
                        "</b><br><br>";
                } else if (questionnaire.type == "crt") {
                    recap +=
                        questionIndex +
                        ". Question: <b>" +
                        questionnaire.questions[i].text +
                        "</b><br>Answer:<b> " +
                        this.questionnaireAnswers[questionIndex - 1] +
                        "</b><br><br>";
                }
                questionIndex++;
            }
        });
        return recap;
    }

    //Generazione della dimensione in base alla scale type
    private selectDimensionToGenerate(dimensionIndex) {
        this.readOnly = true;
        let scaleType = null;

        if (
            this.task.dimensions[dimensionIndex].url &&
            !!this.task.dimensions[dimensionIndex].scale
        ) {
            this.hasDoubleInput = true;
            this.emitEnableSearchEngine();

            this.typingAnimation(
                "Please use the search bar on the right to search for information about the truthfulness of the statement. Once you find a suitable result, please type or select its url"
            );
            scaleType = this.task.dimensions[dimensionIndex].scale.type;
        } else {
            if (
                !this.task.dimensions[dimensionIndex].scale &&
                this.task.dimensions[dimensionIndex].url
            ) {
                scaleType = "url";
            } else if (
                !this.task.dimensions[dimensionIndex].scale &&
                !this.task.dimensions[dimensionIndex].url
            ) {
                scaleType = "textual";
            } else {
                scaleType = this.task.dimensions[dimensionIndex].scale.type;
            }
        }

        switch (scaleType) {
            case "url":
                this.waitForUrl = true;
                this.emitEnableSearchEngine();
                this.typingAnimation(
                    "Please use the search bar on the right to search for information about the truthfulness of the statement. Once you find a suitable result, please type or select its url"
                );

                break;
            case "categorical":
                this.generateCategoricalAnswers(dimensionIndex);

                break;
            case "magnitude_estimation":
                this.generateMagnitudeAnswer(dimensionIndex);

                break;
            case "interval":
                this.generateIntervalAnswer(dimensionIndex);

                break;
            case "textual":
                this.generateTextualAnswer(dimensionIndex);

                break;
            default:
                console.warn("Casistica non gestita");
                break;
        }
        if (scaleType != "url") {
            this.readOnly = false;
        }
        this.statementProvided = true;
        this.timestampsStart[this.currentQuestionnaire + this.taskIndex].push(
            Date.now() / 1000
        );
    }

    //Restituisce l'etichetta del valore della relativa dimensione
    private getCategoricalAnswerLabel(dimensionIndex, answerValue) {
        return (
            this.task.dimensions[dimensionIndex].scale as ScaleCategorical
        ).mapping.find((el) => el.value == answerValue).label;
    }

    //Generazione dati per la revisione del questionario o delle dimensioni dello statement
    private generateRevisionData() {
        this.dropdownListOptions = [];
        //Revisione domande dei questionari
        if (this.questionnaireReview) {
            let index = 1;
            for (let i = 0; i < this.task.questionnaires.length; i++) {
                this.task.questionnaires[i].questions.forEach((question) => {
                    this.dropdownListOptions.push({
                        label: question.text,
                        value: index.toString(),
                    });
                    index++;
                });
            }
        } else {
            //Revisione dimensioni per ogni statement
            this.dropdownListOptions = this.task.dimensions.map(
                (dimension, index) => {
                    return {
                        label: dimension.name_pretty,
                        value: (index + 1).toString(),
                    };
                }
            );
        }
        this.inputComponentToShow = EnConversationalInputType.Dropdown;
    }
    //Generazione risposte del questionario
    private generateQuestionnaireAnswers() {
        this.dropdownListOptions = this.task.questionnaires[
            this.currentQuestionnaire
        ].questions[this.currentQuestion].answers.map((el) => ({
            label: el,
            value: el,
        }));
    }

    private generateFinalStatementRecapData() {
        this.dropdownListOptions = [];

        this.task.hit.documents.forEach((document, index) => {
            this.dropdownListOptions.push({
                label: "Statement " + (index + 1).toString(),
                value: (index + 1).toString(),
            });
        });
    }

    // GENERAZIONE DATI RELATIVI ALLE DIMENSIONI
    private generateCategoricalAnswers(dimensionIndex: number) {
        this.categoricalInfo = [];
        const dimensionInfos = this.task.dimensions[dimensionIndex];
        //Se una dimensione ha più di 5 valori mappati oppure si prevede un doppio input appare la DDL
        if (
            (dimensionInfos.scale as ScaleCategorical).mapping.length > 5 ||
            this.hasDoubleInput
        ) {
            this.dropdownListOptions = (
                dimensionInfos.scale as ScaleCategorical
            ).mapping.map((dimension, index) => {
                return {
                    label: dimension.label,
                    value: dimension.value,
                };
            });
            this.categoricalInfo = (
                dimensionInfos.scale as ScaleCategorical
            ).mapping.map((el: CategoricalInfo) => ({
                label: el.label,
                description: el.description,
                value: el.value,
            }));
            this.inputComponentToShow = EnConversationalInputType.Dropdown;
        }
        //Altrimenti appaiono i pulsanti
        else {
            this.categoricalInfo = (
                dimensionInfos.scale as ScaleCategorical
            ).mapping.map((el: CategoricalInfo) => ({
                label: el.label,
                description: el.description,
                value: el.value,
            }));
            this.inputComponentToShow = EnConversationalInputType.Dropdown;
        }
        //Va a fissare il valore massimo e minimo per la validazione della risposta che verrà fornita
        this.minValue = this.getCategoricalMinInfo(this.categoricalInfo);
        this.maxValue = this.getCategoricalMaxInfo(this.categoricalInfo);
    }

    //Generazione delle risposte intervallari
    private generateIntervalAnswer(dimensionIndex: number) {
        this.intervalInfo = null;
        const dimensionInfos = this.task.dimensions[dimensionIndex]
            .scale as any;
        this.intervalInfo = {
            min: dimensionInfos.min,
            max: dimensionInfos.max,
            step: dimensionInfos.step,
            instructions: dimensionInfos.instructions,
            value: 0,
        };
        this.minValue = dimensionInfos.min;
        this.maxValue = dimensionInfos.max;
        this.inputComponentToShow = EnConversationalInputType.Slider;
    }
    private generateTextualAnswer(dimensionIndex: number) {
        this.placeholderInput = null;
        this.inputComponentToShow = EnConversationalInputType.Text;
    }
    //Generazione delle risposte magnitude
    private generateMagnitudeAnswer(dimensionIndex: number) {
        this.magnitudeInfo = null;
        const dimensionInfos = this.task.dimensions[dimensionIndex]
            .scale as any;
        this.magnitudeInfo = {
            min: dimensionInfos.min ?? 0,
            lowerBound: dimensionInfos.lowerBound ?? null,
            instructions: dimensionInfos.instructions ?? null,
            value: dimensionInfos.value ?? 0,
        };

        this.minValue = dimensionInfos.min;
        this.maxValue = null;
        this.inputComponentToShow = EnConversationalInputType.Number;
    }

    //Resistuiscono il valore minimo e massimo all'interno dell'array di oggetti passato
    getCategoricalMinInfo(objects: CategoricalInfo[]): number {
        return +objects.reduce(function (prev, curr) {
            return +prev.value < +curr.value ? prev : curr;
        }).value;
    }
    getCategoricalMaxInfo(objects: CategoricalInfo[]): number {
        return +objects.reduce(function (prev, curr) {
            return +prev.value > +curr.value ? prev : curr;
        }).value;
    }

    //Restituisce il valore mappato della risposta categoriale
    private getCategoricalAnswerValue(message) {
        const mappedValue = this.categoricalInfo.find(
            (el) => el.label.toLowerCase() == message.toLowerCase()
        );
        if (!!mappedValue) return mappedValue.value;
        else return null;
    }

    //Restituisce il valore mappato della Dropdown visualizzata
    private getDimensionAnswerValue(message) {
        const mappedValue = this.dropdownListOptions.find(
            (el) => el.label.toLowerCase() == message.toLowerCase()
        );
        if (!!mappedValue) return mappedValue.value;
        else return null;
    }

    private getFinalRevisionAnswerValue(message: string) {
        return +message.split(" ")[1] - 1;
    }

    private getAnswerValidity(
        dimensionIndex: number,
        message: string,
        url: string
    ): boolean {
        let isValid = false;
        if (
            !!this.task.dimensions[dimensionIndex].scale &&
            !!this.task.dimensions[dimensionIndex].url
        ) {
            isValid =
                ChatHelper.validMsg(message, this.minValue, this.maxValue) &&
                ChatHelper.urlValid(url);
        } else if (this.waitForUrl) {
            isValid = ChatHelper.urlValid(url);
        } else
            isValid = ChatHelper.validMsg(
                message,
                this.minValue,
                this.maxValue
            );

        return isValid;
    }

    private resetCountdown() {
        this.showCountdown = false;
        clearInterval(this.activeInterval);
    }
    /* -- MODELLAZIONE E INVIO DATI AL SERVIZIO DI STORAGE -- */
    //Salvataggio informazione relativa alla scadenza del countdown
    private storeCountdownData() {
        if (this.taskStatus == EnConversationaTaskStatus.TaskPhase)
            this.task.countdownsExpired[this.taskIndex] = true;
    }
    //Invio dei dati relativi al questionario
    private uploadQuestionnaireData(questionnaireIndex: number) {
        let answers = this.buildQuestionnaireAnswersData(questionnaireIndex);
        let questionnairePayload = this.buildTaskQuestionnairePayload(
            questionnaireIndex,
            answers,
            this.action
        );
        // this.dynamoDBService.insertDataRecord(
        //     this.configService.environment,
        //     this.worker,
        //     this.task,
        //     questionnairePayload
        // );
        this.task.sequenceNumber += 1;
    }
    //Modellazione delle risposte del questionario
    private buildQuestionnaireAnswersData(questionnaireIndex: number) {
        let questionnaireData = [];
        let addOn = "_answer";

        let answers = {};
        this.task.questionnaires[questionnaireIndex].questions.forEach(
            (question, index) => {
                questionnaireData.push(
                    (answers[question.name + addOn] =
                        this.questionnaireAnswers[index])
                );
            }
        );

        return questionnaireData;
    }
    private buildTaskQuestionnairePayload(questionnaireIndex, answers, action) {
        let data = {};
        data["info"] = {
            action: action,
            access: this.accessesAmount[questionnaireIndex],
            try: this.task.tryCurrent,
            index: questionnaireIndex,
            sequence: this.task.sequenceNumber,
            element: "questionnaire",
        };
        /* Worker's answers to the current questionnaire */
        let questionsFull = [];

        for (let question of this.task.questionnaires[questionnaireIndex]
            .questions) {
            if (!question.dropped) questionsFull.push(question);
        }

        data["questions"] = questionsFull;
        data["answers"] = answers;
        /* Start, end and elapsed timestamps for the current questionnaire */
        data["timestamps_start"] = this.timestampsStart[questionnaireIndex];
        data["timestamps_end"] = this.timestampsEnd[questionnaireIndex];
        data["timestamps_elapsed"] = this.timestampsElapsed[questionnaireIndex];
        /* Number of accesses to the current questionnaire (which must be always 1, since the worker cannot go back */
        data["accesses"] = this.accessesAmount[questionnaireIndex];
        return data;
    }
    private async uploadDocumentData() {
        let answers = this.buildAnswerDataFormat();

        let documentPayload = this.buildTaskDocumentPayload(
            this.taskIndex,
            answers,
            null,
            this.action
        );

        // await this.dynamoDBService.insertDataRecord(
        //     this.configService.environment,
        //     this.worker,
        //     this.task,
        //     documentPayload
        // );

        this.task.sequenceNumber += 1;
        this.dimsSelected = [];
        this.query = [];
        this.queryRetrieved = [];
        this.querySelectedUrls = [];
    }
    //Modellazione delle risposte da salvare
    private buildAnswerDataFormat() {
        let answers = {};
        let addOn = "_value";
        for (let i = 0; i < this.task.dimensions.length; i++) {
            if (!!this.task.dimensions[i].scale) {
                answers[this.task.dimensions[i].name + addOn] =
                    this.answers[this.taskIndex][i].dimensionValue;
            }
            if (!!this.task.dimensions[i].url) {
                answers[this.task.dimensions[i].name + "_url"] =
                    this.answers[this.taskIndex][i].urlValue;
            }
        }
        return answers;
    }
    public buildTaskDocumentPayload(documentIndex, answers, countdown, action) {
        let data = {};
        /* Info about the performed action  */
        data["info"] = {
            action: action,
            access: this.accessesAmount[
                this.currentQuestionnaire + documentIndex
            ],
            try: this.task.tryCurrent,
            index: documentIndex,
            sequence: this.task.sequenceNumber,
            element: "document",
        };
        /* Worker's answers for the current document */
        data["answers"] = answers;
        data["notes"] = [];
        /* Worker's dimensions selected values for the current document */
        data["dimensions_selected"] = [];
        /* Worker's search engine queries for the current document */
        data["queries"] = this.query[documentIndex];
        /* Start, end and elapsed timestamps for the current document */
        data["timestamps_start"] =
            this.timestampsStart[this.currentQuestionnaire + documentIndex];
        data["timestamps_end"] =
            this.timestampsEnd[this.currentQuestionnaire + documentIndex];
        data["timestamps_elapsed"] =
            this.timestampsElapsed[this.currentQuestionnaire + documentIndex];
        /* Countdown time and corresponding flag */
        data["countdowns_times_start"] = [];
        data["countdowns_times_left"] = this.countdownLeftTime[this.taskIndex];
        data["countdowns_expired"] =
            this.task.countdownsExpired[this.taskIndex];
        /* Number of accesses to the current document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
        data["accesses"] =
            this.accessesAmount[this.currentQuestionnaire + documentIndex];
        /* Responses retrieved by search engine for each worker's query for the current document */
        data["responses_retrieved"] = this.queryRetrieved[documentIndex];
        /* Responses by search engine ordered by worker's click for the current document */
        data["responses_selected"] = this.querySelectedUrls[documentIndex];
        return data;
    }
    private validateTask(): boolean {
        /* 2) GOLD ELEMENTS CHECK performed here */

        let goldConfiguration = [];
        /* For each gold document its attribute, answers and notes are retrieved to build a gold configuration */
        for (let goldDocument of this.task.goldDocuments) {
            let currentConfiguration = {};
            currentConfiguration["document"] = goldDocument;
            let answers = {};
            //Si estrae il nome della gold dimension e il relativo valore salvato nelle answers
            for (let goldDimension of this.task.goldDimensions) {
                answers[goldDimension.name] = this.answers[goldDocument.index];
            }
            currentConfiguration["answers"] = answers;
            currentConfiguration["notes"] = [];
            goldConfiguration.push(currentConfiguration);
        }

        /* The gold configuration is evaluated using the static method implemented within the GoldChecker class */
        let goldChecks = GoldChecker.performGoldCheck(goldConfiguration);
        return goldChecks.every((el) => !!el);
    }

    public buildCommentPayload(comment) {
        let data = {};
        let actionInfo = {
            try: this.task.tryCurrent,
            sequence: this.task.sequenceNumber,
            element: "comment",
        };
        data["info"] = actionInfo;
        data["comment"] = comment;
        this.task.sequenceNumber = this.task.sequenceNumber + 1;
        return data;
    }

    private taskQualityCheck() {
        /* 2) GOLD ELEMENTS CHECK performed here */

        let goldConfiguration = [];
        /* For each gold document its attribute, answers and notes are retrieved to build a gold configuration */
        for (let goldDocument of this.task.goldDocuments) {
            let currentConfiguration = {};
            currentConfiguration["document"] = goldDocument;
            let answers = {};
            for (let goldDimension of this.task.goldDimensions) {
                for (let [attribute, value] of Object.entries(
                    this.task.documents[goldDocument.index]
                )) {
                    let dimensionName = attribute.split("_")[0];
                    if (dimensionName == goldDimension.name) {
                        answers[attribute] = value;
                    }
                }
            }
            currentConfiguration["answers"] = answers;
            currentConfiguration["notes"] = this.task.notes
                ? this.task.notes[goldDocument.index]
                : [];
            goldConfiguration.push(currentConfiguration);
        }

        /* The gold configuration is evaluated using the static method implemented within the GoldChecker class */
        let goldChecks = GoldChecker.performGoldCheck(goldConfiguration);
        this.task.buildQualityChecksPayload(goldChecks);
    }

    public performGlobalValidityCheck() {
        /* The "valid" flag of each questionnaire or document form must be true to pass this check. */
        let questionnaireFormValidity = true;
        let documentsFormValidity = true;
        // for (let index = 0; index < this.question.length; index++)
        //     if (this.questionnairesForm[index].valid == false)
        //         questionnaireFormValidity = false;
        // for (let index = 0; index < this.documentsForm.length; index++)
        //     if (this.documentsForm[index].valid == false)
        //         documentsFormValidity = false;
        return questionnaireFormValidity && documentsFormValidity;
    }

    public loadTimestamps() {
        /* Arrays of start, end and elapsed timestamps are initialized to track how much time the worker spends
         * on each document, including each questionnaire */
        this.timestampsStart = new Array<Array<number>>(
            this.getElementsNumber()
        );
        this.timestampsEnd = new Array<Array<number>>(this.getElementsNumber());
        this.timestampsElapsed = new Array<number>(this.getElementsNumber());
        for (let i = 0; i < this.timestampsStart.length; i++)
            this.timestampsStart[i] = [];
        for (let i = 0; i < this.timestampsEnd.length; i++)
            this.timestampsEnd[i] = [];
    }

    public loadAccessCounter() {
        /* The array of accesses counter is initialized */
        let elementsAmount = this.getElementsNumber();
        this.elementsAccesses = new Array<number>(elementsAmount);
        for (let index = 0; index < this.elementsAccesses.length; index++)
            this.elementsAccesses[index] = 0;
    }

    private getElementsNumber() {
        return this.task.documentsAmount + this.task.questionnaireAmount;
    }
}
