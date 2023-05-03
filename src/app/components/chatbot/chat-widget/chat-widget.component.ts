import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    EventEmitter,
    Component,
    ElementRef,
    Input,
    OnInit,
    ViewChild,
    ViewEncapsulation,
} from "@angular/core";
import { fadeIn } from "../animations";
import { NgxUiLoaderService } from "ngx-ui-loader";
import { S3Service } from "../../../services/aws/s3.service";
import { DynamoDBService } from "../../../services/aws/dynamoDB.service";
import { SectionService } from "../../../services/section.service";
import { ConfigService } from "../../../services/config.service";
/* Models */
import { Task } from "../../../models/skeleton/task";
import {
    AnswerModel,
    CategoricalInfo,
    DropdownSelectItem,
    InputType,
    ConversationState,
    IntervalDimensionInfo,
    MagnitudeDimensionInfo,
    ButtonsType,
} from "../../../models/conversational/common.model";
import { ScaleCategorical } from "../../../models/skeleton/dimension";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { GoldChecker } from "data/build/skeleton/goldChecker";
import ChatHelper from "./chat-helpers";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { ChatCommentModalComponent } from "../chat-modals/chat-comment-modal/chat-comment-modalcomponent";
import { ChatInstructionModalComponent } from "../chat-modals/chat-instruction-modal/chat-instruction-modal.component";

// Main
@Component({
    selector: "chat-widget",
    templateUrl: "./chat-widget.component.html",
    styleUrls: ["./chat-widget.component.css"],
    animations: [fadeIn],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWidgetComponent implements OnInit {
    @ViewChild("chatbody") chatbody!: ElementRef;
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
    dimensionIndex: number; // Tiene il conto della dimensione attuale
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
    action: string;
    readOnly = true;
    queryIndex: number[];
    sendData = false;
    conversationState: ConversationState;
    public buttonsToShow = ButtonsType.None;
    public enButtonType = ButtonsType;
    public hasDoubleInput = false;
    // Variables
    fixedMessage: string; // Messaggio sempre visibile in alto nel chatbot
    statementAuthor: string;
    statementDate: string;
    answers: AnswerModel[][] = []; //
    questionnaireAnswers: any[] = [];
    queue: number;
    textInputPlaceHolder: string;
    urlInputValue: string;
    tryNumber: number; // Numero di tentativi per completare
    accessesAmount: number[]; //Numero di accessi agli elementi
    public conversationInitialized = false;
    public finishedExampleActivity = false;
    public urlValue = "";
    private minValue: number = -2; //Valore validazione estremo inferiore
    private maxValue: number = +2; //Valore validazione estremo superirore

    //Countdown
    public countdownValue: Observable<number>; //Valore in secondi
    private countdownValueSubject = new BehaviorSubject<number>(0);
    private progress: number; // Percentuale di completamento della barra del timer
    public timerIsOver: Observable<boolean>; //Flag countdown scaduto
    private timerIsOverSubject = new BehaviorSubject<boolean>(false);
    //Interval per la gestione del countdown
    private activeInterval: any;
    public showCountdown = false; //Interval per la gestione del countdown
    private countdownLeftTimeContainer = [];
    private countdownTimeStartContainer = [];

    //Quality check
    private goldConfiguration = [];
    private goldChecks = [];
    public showMessageInput = true;

    //Show components flag
    public EnInputType = InputType;
    public inputComponentToShow: InputType = InputType.Text;

    //Containers
    public categoricalInfo: CategoricalInfo[] = [];
    public magnitudeInfo: MagnitudeDimensionInfo = null;
    public intervalInfo: IntervalDimensionInfo = null;
    public dropdownListOptions: DropdownSelectItem[] = [];

    // Messaggi per l'utente
    public messagesForUser = [
        "Hello &#x1F60A<br>My name is Fakebot and I'll be helping you complete this task! You can find the <b>instructions</b> near my name, at the top of this chat, you can find a question mark, just press it whenever you need. Nothing will break down, I promise! &#x1F609;",
        "What's your name? If you don't want to tell me your name just write <b>no</b> in the chat and press send",
        "Hi {name}, it's a pleasure chatting with you. Are you ready?",
        "No problem, so are you ready?",
        "Nice, let's start with the task! &#x1F60E;",
        "Great, thanks for providing me with this information. Now let's start with the main activity",
        "I'll now show you some statements and for each one I'll ask you some questions. Please use the search bar on the right to search for info about those statement and answer my questions",
        "Would you like to play a test round?",
        "When you are ready click on <b>Yes</b> and so we can start this task together. &#x1F601;",
        "Are you sure about that answer? Check it please &#128064;",
        "Nice! Now we can start with the real task. &#x1F60A;",
        "Okay, that is great, so we can start immediatly with the real task. &#x1F60A;",
        "Thanks for finishing the task, this is your token:",
    ];

    // Messaggi random
    public randomMessagesFirstPart = [
        "OK!",
        "Gotcha!",
        "Makes sense!",
        "Sure!",
        "I see!",
        "Thanks {name}!",
        "Thank you!",
        "Alright, I understand.",
        "Understood, thank you {name}.",
        "Got it, thanks!",
        "Okay {name}, thanks for letting me know.",
        "Great, I understand now.",
        "Thanks for clarifying that for me {name}.",
        "Thanks for the information, I see now.",
        "Perfect, thanks {name}!",
        "I appreciate your help {name}, thanks!",
    ];

    public randomMessagesSecondPart = [
        "Let's proceed {name}...",
        "Let me write that down {name}...",
        "The next question is...",
        "On to the next question...",
        "The following question is...",
        "Here's the next question {name}...",
        "Moving right along, the next question is...",
        "Let's move on to the next question {name}, which is...",
        "Next up, we have the following question...",
        "The next topic we'll cover is...",
        "Our next question is...",
        "Now let's turn to the next question {name}, which is...",
        "The next item on our list is...",
        "We'll now proceed to the next question, which is...",
        "Up next, we have the following question...",
        "Let's jump to the next question {name}, which is...",
    ];

    //Info worker
    private userName: string;

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
        avatar: "",
    };

    public client = {
        name: "Worker",
        user: "test_user",
        status: "online",
        avatar: `https://www.linkpicture.com/q/user-icon.png`,
    };

    private exampleStatement = {
        speaker_name: "John Doe",
        statement_date: "2023-01-01",
        statement_text:
            "\u201c The number three is always equal to three. It's also equal to six divided by two\"",
        dimensionInfo: {
            name: "truthfulness",
            scale: {
                type: "categorical",
                instructions: {
                    label: "D",

                    text: "Evaluate the Overall Truthfulness of the statement",
                },
                mapping: [
                    {
                        label: "Lie",
                        description: "",
                        value: "0",
                    },
                    {
                        label: "False",
                        description: "",
                        value: "1",
                    },
                    {
                        label: "Barely True",
                        description: "",
                        value: "2",
                    },
                    {
                        label: "Half True",
                        description: "",
                        value: "3",
                    },
                    {
                        label: "Mostly True",
                        description: "",
                        value: "4",
                    },
                    {
                        label: "True",
                        description: "",
                        value: "5",
                    },
                ],
            },
        },
    };

    public messages: any[] = [];

    private initializeContainers() {
        const { documents, questionnaires, settings, dimensions } = this.task;
        this.countdownLeftTimeContainer = !!settings.countdown_time
            ? Array(documents.length).fill(0)
            : [];
        this.countdownTimeStartContainer = !!settings.countdown_time
            ? Array(documents.length).fill(0)
            : [];
        this.accessesAmount = Array(
            questionnaires.length + documents.length
        ).fill(0);
        this.queryIndex = Array(documents.length).fill(0);
        this.questionnaireAnswers = Array(
            ChatHelper.getTotalElements(questionnaires, "questions")
        ).fill("");
        this.answers = Array.from({ length: documents.length }, () =>
            Array.from({ length: dimensions.length }, () => ({
                dimensionValue: null,
            }))
        );
    }

    ngOnInit() {
        let random = Math.floor(Math.random() * 9);
        this.operator.avatar =
            "https://randomuser.me/api/portraits/lego/" + random + ".jpg";
        this.task = this.sectionService.task;
        this.typing.nativeElement.style.display = "none";
        // Inizializzo
        this.ignoreMsg = false;
        this.dimensionIndex = 0;
        this.taskIndex = 0;
        this.dimensionReviewPrinted = false;
        this.reviewAnswersShown = false;
        this.pickReview = false;
        this.statementJump = false;
        this.waitForUrl = false;
        this.awaitingAnswer = false;
        this.currentQuestionnaire = 0;
        this.currentQuestion = 0;
        this.conversationState = ConversationState.Questionnaire;
        this.statementProvided = false;
        this.queue = 0;
        this.textInputPlaceHolder = "";
        this.urlInputValue = "";
        this.tryNumber = 1;
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
        this.countdownValue = this.countdownValueSubject.asObservable();
        this.timerIsOver = this.timerIsOverSubject.asObservable();
        this.progress = 0;

        //Dimensionamento dei vettori relativi ai documenti, le dimensioni e le risposte
        this.initializeContainers();
        //Disabilito il motore di ricerca
        this.emitDisableSearchEngine();
        /* Arrays of start, end and elapsed timestamps are initialized to track how much time the worker spends
         * on each document, including each questionnaire */
        this.loadTimestamps();

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
        this.initializeConversation();
    }

    // Core
    public sendMessage({ message }) {
        if (this.conversationInitialized) {
            if (this.ignoreMsg) return;
            if (this.hasDoubleInput) {
                this.emitGetUrlValue();
            }
            message = !!message.label ? message.label : message;
            if (this.hasDoubleInput) {
                this.addMessageClient(
                    this.client,
                    { url: this.urlValue, value: message },
                    "sent",
                    true
                );
            } else {
                this.addMessageClient(this.client, message, "sent");
            }
            switch (this.conversationState) {
                case ConversationState.End:
                    this.endP(message);
                    return;
                case ConversationState.Questionnaire:
                    let isFinished = this.questionnaireP(message);
                    if (isFinished) this.reviewP(message);
                    break;
                case ConversationState.TaskInstructions:
                    this.instructionP(message);
                    break;
                case ConversationState.Task:
                    this.taskP(message);
                    break;
                case ConversationState.TaskReview:
                case ConversationState.QuestionnaireReview:
                    this.reviewP(message);
                    break;
            }
        } else {
            if (this.buttonsToShow != ButtonsType.None) {
                message = message.label ?? message;
            }
            this.addMessageClient(this.client, message, "sent");
            if (message.toLowerCase() == "yes") {
                this.buttonsToShow = ButtonsType.None;
                this.changeDetector.detectChanges();
                this.conversationInitialized = true;
                this.initializeConversation();
            } else {
                //Controlla se al worker è stato chiesto il nome
                if (!this.userName) {
                    if (message.toLowerCase() != "no") {
                        //capitalizzazione del nome
                        this.userName = message
                            .trim()
                            .replace(/^\w/, (c) => c.toUpperCase());
                    } else {
                        this.userName = "!NONAME";
                    }
                    this.initializeConversation();
                    return;
                }
                this.typingAnimation(this.messagesForUser[8]);
                return;
            }
        }
    }

    // Fase dei questionari
    private questionnaireP(message): boolean {
        const { questionnaires } = this.task;
        //E' in attesa di una risposta?
        if (this.awaitingAnswer) {
            if (
                this.inputComponentToShow == InputType.Number &&
                !ChatHelper.validMsg(message, 1, 100)
            ) {
                this.typingAnimation(
                    "Please type a integer number between 1 and 100"
                );
                return;
            } else {
                this.questionnaireAnswers[
                    this.getGlobalQuestionIndex(
                        this.currentQuestionnaire,
                        this.currentQuestion
                    )
                ] = message;
                this.inputComponentToShow = InputType.Text;

                this.currentQuestion++;
                this.awaitingAnswer = false;
                if (
                    this.currentQuestion >=
                    questionnaires[this.currentQuestionnaire].questions.length
                ) {
                    this.timestampsEnd[this.currentQuestionnaire].push(
                        ChatHelper.getTimeStampInSeconds()
                    );
                    //Calcolo tempo trascorso tra il completamento di due questionari
                    this.timestampsElapsed[this.currentQuestionnaire] =
                        this.timestampsEnd[this.currentQuestionnaire][0] -
                        this.timestampsStart[this.currentQuestionnaire][0];
                    this.uploadQuestionnaireData(this.currentQuestionnaire);
                    this.currentQuestion = 0;
                    this.currentQuestionnaire++;

                    if (this.currentQuestionnaire >= questionnaires.length) {
                        this.readOnly = true;
                        this.conversationState =
                            ConversationState.QuestionnaireReview;
                    } else {
                        this.randomMessage();
                        this.timestampsStart[this.currentQuestionnaire].push(
                            ChatHelper.getTimeStampInSeconds()
                        );
                    }
                } else {
                    this.randomMessage();
                }
            }
            if (this.checkIfQuestionnaireIsFinished()) return true;
        }
        //Non è in attesa, quindi genera la domanda successiva
        if (questionnaires[this.currentQuestionnaire].type == "standard") {
            this.readOnly = true;
            this.showMessageInput = true;
            this.printQuestion();
            this.typingAnimation(this.createQuestionnaireAnswers());
            this.generateQuestionnaireAnswers();
            setTimeout(() => {
                this.showMessageInput = false;
                this.changeDetector.detectChanges();
            }, 1600);
            this.readOnly = false;
            this.inputComponentToShow = InputType.Dropdown;
        } else if (questionnaires[this.currentQuestionnaire].type == "likert") {
            this.readOnly = true;
            this.showMessageInput = true;
            this.typingAnimation(
                questionnaires[this.currentQuestionnaire].questions[
                    this.currentQuestion
                ].text
            );
            this.typingAnimation(this.createLikertQuestionnaireAnswers());
            this.generateLikertQuestionnaireAnswers();
            setTimeout(() => {
                this.showMessageInput = false;
            }, 1600);
            this.readOnly = false;
            this.inputComponentToShow = InputType.Dropdown;
        } else if (questionnaires[this.currentQuestionnaire].type == "crt") {
            this.typingAnimation(
                questionnaires[this.currentQuestionnaire].questions[
                    this.currentQuestion
                ].text
            );
            this.showMessageInput = true;
            this.inputComponentToShow = InputType.Number;
            setTimeout(() => {
                this.showMessageInput = false;
                this.changeDetector.detectChanges();
            }, 1600);
        }

        this.awaitingAnswer = true;
        return;
    }

    // Fase di istruzioni
    private instructionP(message?: any) {
        this.ignoreMsg = true;
        if (!this.finishedExampleActivity && !message) {
            this.typingAnimation(this.messagesForUser[5]);
            let instruction = this.getInstructions();
            this.typingAnimation(instruction);

            this.typingAnimation(this.messagesForUser[7]);
            setTimeout(() => {
                this.ignoreMsg = false;
                this.buttonsToShow = ButtonsType.YesNo;
                this.changeDetector.detectChanges();
            }, 1600);
            return;
        } else {
            //Se non ho generato il messaggio di prova
            if (!this.finishedExampleActivity && !this.fixedMessage) {
                if (message.toLowerCase() == "yes") {
                    this.buttonsToShow = ButtonsType.None;
                    this.printExampleStatement();
                    this.generateExampleDimension();
                } else if (message.toLowerCase() == "no") {
                    this.buttonsToShow = ButtonsType.None;
                    this.typingAnimation(this.messagesForUser[11]);
                    this.inputComponentToShow = InputType.Text;
                    setTimeout(() => {
                        this.conversationState = ConversationState.Task;
                        this.taskP("startTask");
                    }, 1600);
                    return;
                }
            } else if (!this.finishedExampleActivity && this.fixedMessage) {
                if (message.toLowerCase() === "true") {
                    //Far scrivere messagio al bot
                    this.typingAnimation(this.messagesForUser[10]);
                    this.finishedExampleActivity = true;
                    this.fixedMessage = null;
                    this.showMessageInput = true;
                    this.statementDate = null;
                    this.statementAuthor = null;
                    this.categoricalInfo = [];
                    this.dropdownListOptions = [];
                    this.inputComponentToShow = InputType.Text;
                    setTimeout(() => {
                        this.conversationState = ConversationState.Task;
                        this.taskP("startTask");
                    }, 1600);
                } else {
                    //Risposta errata, si aspetta il messaggio corretto
                    this.typingAnimation(this.messagesForUser[9]);
                    return;
                }
            }
        }
    }

    // Fase di task
    private taskP(message) {
        let validAnswer = true;
        if (
            this.inputComponentToShow == InputType.Dropdown ||
            this.inputComponentToShow == InputType.Button
        ) {
            message = this.getCategoricalAnswerValue(message);
        }
        //E' l'ultima dimensione dello statement?
        if (
            this.dimensionIndex == this.task.dimensionsAmount - 1 &&
            this.getAnswerValidity(this.dimensionIndex, message, this.urlValue)
        ) {
            //Stop del interval
            if (this.task.settings.countdown_time) {
                this.countdownLeftTimeContainer[this.taskIndex] =
                    this.countdownValueSubject.value;
                this.resetCountdown();
            }
            //Salvo il tempo di fine
            this.timestampsEnd[
                this.task.questionnaires.length + this.taskIndex
            ][0] = ChatHelper.getTimeStampInSeconds();

            this.checkInputAnswer(message, this.taskIndex, this.dimensionIndex);
            this.statementProvided = false;
            this.reviewAnswersShown = false;
            this.conversationState = ConversationState.TaskReview;
            this.reviewP(message);
            return;
        } else {
            validAnswer = this.checkInputAnswer(
                message,
                this.taskIndex,
                this.dimensionIndex
            );
            if (validAnswer) {
                this.dimensionIndex++;
                this.inputComponentToShow = InputType.Text;
            }
        }

        //Visualizzazione dello statement
        if (!this.fixedMessage) {
            this.printStatement();
        }
        //Visualizzazione della dimensione
        if (!!this.fixedMessage) {
            if (
                !!this.task.settings.countdown_time &&
                this.dimensionIndex == 0
            ) {
                this.setCountdown();
            }
            if (validAnswer || message == "startTask") {
                this.printDimension(this.taskIndex, this.dimensionIndex);
                setTimeout(() => {
                    if (this.inputComponentToShow != InputType.Button)
                        this.showMessageInput = false;

                    this.changeDetector.detectChanges();
                }, 1600);
                this.selectDimensionToGenerate(this.dimensionIndex);
            }

            this.ignoreMsg = false;
        } else {
            this.ignoreMsg = false;
        }
    }

    // Fase di review
    private reviewP(message) {
        const { questionnaires } = this.task;
        if (
            !this.dimensionReviewPrinted &&
            this.inputComponentToShow == InputType.Dropdown
        ) {
            message = this.getDropdownAnswerValue(message);
        }
        //Modifica di un questionario
        if (this.conversationState === ConversationState.QuestionnaireReview) {
            if (this.pickReview) {
                //E' in attesa della risposta da parte dell'utente
                if (this.awaitingAnswer) {
                    if (
                        questionnaires[this.currentQuestionnaire].type == "crt"
                    ) {
                        if (!ChatHelper.validMsg(message, 1, 100)) {
                            this.typingAnimation(
                                "Please type a integer number between 1 and 100"
                            );
                            return;
                        }
                    }
                    if (
                        questionnaires[this.currentQuestionnaire].type ==
                        "likert"
                    ) {
                        message = questionnaires[
                            this.currentQuestionnaire
                        ].mappings.find((el) => el.value == message).label;
                    }
                    let globalIndex = this.getGlobalQuestionIndex(
                        this.currentQuestionnaire,
                        this.currentQuestion
                    );
                    this.questionnaireAnswers[globalIndex] = message;
                    this.reviewAnswersShown = false;
                    this.pickReview = false;
                    this.awaitingAnswer = false;

                    this.timestampsEnd[this.currentQuestionnaire][0] =
                        ChatHelper.getTimeStampInSeconds();
                    this.timestampsElapsed[this.currentQuestionnaire] =
                        this.timestampsEnd[this.currentQuestionnaire][0] -
                        this.timestampsStart[this.currentQuestionnaire][0];
                    this.uploadQuestionnaireData(this.currentQuestionnaire);
                } else {
                    //Revisione della domanda
                    let globalQuestionIndex = +message;
                    // Viene calcolato il questionario di appartenenza della domanda e l'indice relativo alla domanda
                    this.currentQuestionnaire =
                        this.getQuestionnaireIndexByQuestionGlobalIndex(
                            globalQuestionIndex
                        );
                    this.currentQuestion =
                        this.getLocalQuestionIndexByGlobalIndex(
                            globalQuestionIndex
                        );

                    this.printQuestion();
                    this.awaitingAnswer = true;

                    if (
                        questionnaires[this.currentQuestionnaire].type ==
                        "standard"
                    ) {
                        this.typingAnimation(this.createQuestionnaireAnswers());
                        this.generateQuestionnaireAnswers();
                        this.readOnly = false;
                        this.inputComponentToShow == InputType.Dropdown;
                        return;
                    } else if (
                        questionnaires[this.currentQuestionnaire].type ==
                        "likert"
                    ) {
                        this.readOnly = true;
                        this.showMessageInput = true;
                        this.typingAnimation(
                            this.createLikertQuestionnaireAnswers()
                        );
                        this.generateLikertQuestionnaireAnswers();
                        setTimeout(() => {
                            this.showMessageInput = false;
                            this.changeDetector.detectChanges();
                        }, 1600);
                        this.readOnly = false;
                        this.inputComponentToShow = InputType.Dropdown;
                        return;
                    } else if (
                        questionnaires[this.currentQuestionnaire].type == "crt"
                    ) {
                        this.inputComponentToShow = InputType.Number;

                        return;
                    }
                    this.buttonsToShow = ButtonsType.None;
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
                setTimeout(() => {
                    this.buttonsToShow = ButtonsType.Confirm;
                    this.changeDetector.detectChanges();
                }, 2400);

                return;
            }
            //Confermo le risposte del questionario
            if (message.trim().toLowerCase() === "confirm") {
                this.inputComponentToShow = InputType.Text;
                this.buttonsToShow = ButtonsType.None;

                // Preparazione fase delle istruzioni
                this.taskIndex = 0;
                this.dimensionIndex = 0;
                this.reviewAnswersShown = false;
                this.ignoreMsg = true;
                this.conversationState = ConversationState.TaskInstructions;
                this.awaitingAnswer = false;
                this.pickReview = false;
                this.instructionP();

                return;
            } else if (message.trim().toLowerCase() === "modify") {
                this.buttonsToShow = ButtonsType.None;
                this.action = "Back";
                this.typingAnimation("Which one would you like to modify?");
                this.generateRevisionData();
                this.pickReview = true;
                this.timestampsStart[this.currentQuestionnaire][0] =
                    ChatHelper.getTimeStampInSeconds();
                return;
            } else {
                //La risposta fornita non è valida, si rimane in attesa
                return;
            }
        }
        // Modifica di una dimensione
        if (this.pickReview) {
            // La dimensione è visualizzata
            if (this.dimensionReviewPrinted) {
                //Check risposta con doppio input
                if (
                    this.inputComponentToShow == InputType.Dropdown ||
                    this.inputComponentToShow == InputType.Button
                ) {
                    message = this.getCategoricalAnswerValue(message);
                }
                let isValid = this.checkInputAnswer(
                    message,
                    this.taskIndex,
                    this.dimensionIndex
                );
                if (isValid) this.inputComponentToShow = InputType.Text;
                else return;
            } else {
                this.cleanUserInput();

                //Faccio scegliere quale dimensione visualizzare
                if (
                    !ChatHelper.validMsg(message, 1, this.task.dimensionsAmount)
                ) {
                    let messageToSend = `Please type a integer number between 1 and ${this.task.dimensionsAmount}`;
                    this.typingAnimation(messageToSend);
                    return;
                }
                this.dimensionIndex = +message;
                if (this.dimensionIndex > 0) this.dimensionIndex--;

                //Visualizzazione della dimensione richiesta e relativi dati
                this.printDimension(this.taskIndex, this.dimensionIndex);
                this.dimensionReviewPrinted = true;
                this.selectDimensionToGenerate(this.dimensionIndex);
                this.showMessageInput = false;
                return;
            }
            this.cleanUserInput();
            // Reset della fase di revisione
            this.reviewAnswersShown = false;
            this.pickReview = false;
        }

        // Ripeto questa fase finchè non ricevo un Confirm
        if (!this.reviewAnswersShown) {
            this.cleanUserInput();
            this.typingAnimation("Let's review your answers!");
            this.typingAnimation(
                this.createDocumentRecap(this.taskIndex) +
                    "<br>Confirm your answers?"
            );
            setTimeout(() => {
                this.buttonsToShow = ButtonsType.Confirm;
                this.changeDetector.detectChanges();
            }, 2400);
            this.reviewAnswersShown = true;
            return;
        } //Conferma le risposte dell'assignment
        if (message.trim().toLowerCase() === "confirm") {
            this.inputComponentToShow = InputType.Text;
            this.buttonsToShow = ButtonsType.None;

            let currentElementIndex =
                this.task.questionnaires.length + this.taskIndex;
            this.timestampsEnd[currentElementIndex][0] =
                ChatHelper.getTimeStampInSeconds();
            this.timestampsElapsed[currentElementIndex] =
                this.timestampsEnd[currentElementIndex][0] -
                this.timestampsStart[currentElementIndex][0];
            this.uploadDocumentData(this.taskIndex);

            //Il documento viene contrassegnato come completato
            document.getElementById(this.taskIndex.toString()).className =
                "dot completed ";
            // Se era l'ultimo statement, passo alla fase finale
            if (
                this.task.hit.documents.length - 1 <= this.taskIndex ||
                this.statementJump
            ) {
                this.statementJump = false;
                this.conversationState = ConversationState.End;
                this.reviewAnswersShown = false;
                this.typingAnimation(
                    "OK! Would you like to jump to a specific statement?"
                );
                this.cleanUserInput();

                setTimeout(() => {
                    this.buttonsToShow = ButtonsType.YesNo;
                    this.readOnly = false;
                    this.changeDetector.detectChanges();
                }, 2400);

                return;
            } else {
                this.randomMessage();
                this.conversationState = ConversationState.Task;
                this.action = "Next";
                this.taskIndex++;
                this.reviewAnswersShown = false;
                this.ignoreMsg = true;
                this.dimensionIndex = 0;
                this.fixedMessage = null;
                this.taskP("startTask");
            }
        } else if (message.trim().toLowerCase() === "modify") {
            this.action = "Back";
            this.buttonsToShow = ButtonsType.None;
            this.typingAnimation("Which dimension would you like to change?");
            this.cleanUserInput();
            setTimeout(() => {
                this.generateRevisionData();
                this.readOnly = false;
                this.changeDetector.detectChanges();
            }, 2400);

            this.pickReview = true;
            this.dimensionReviewPrinted = false;
            return;
        } else {
            return;
        }
    }

    // Fase di fine task
    private async endP(message) {
        if (this.statementJump) {
            this.getDropdownAnswerValue(message);
            this.taskIndex = this.getFinalRevisionAnswerValue(message);
            this.dimensionIndex = 0;
            this.printStatement();
            this.conversationState = ConversationState.TaskReview;
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
                    this.createStatementsRecap() +
                        "Which statement would you like to jump to?"
                );
                this.buttonsToShow = ButtonsType.None;
                this.inputComponentToShow = InputType.Dropdown;
                this.generateFinalStatementRecapData();
                this.statementJump = true;
            } else if (message.trim().toLowerCase() === "no") {
                this.inputComponentToShow = InputType.Text;
                this.buttonsToShow = ButtonsType.None;
                this.action = "Finish";
                this.task.sequenceNumber += 1;
                // INVIO DATI COL CONTROLLO QUALITA
                this.taskQualityCheck();
                let validTry = this.goldChecks.every((el) => !!el);
                let timeSpentCheck = this.taskTimeCheck();
                let globalValidityCheck = this.performGlobalValidityCheck();

                let qualityCheckData = {
                    globalOutcome: null,
                    globalFormValidity: globalValidityCheck,
                    timeSpentCheck: timeSpentCheck,
                    timeCheckAmount: this.task.settings.time_check_amount,
                    goldChecks: this.goldChecks,
                    goldConfiguration: this.goldConfiguration,
                };

                let checksOutcome = [];
                let checker = (array) => array.every(Boolean);
                checksOutcome.push(qualityCheckData["globalFormValidity"]);
                checksOutcome.push(qualityCheckData["timeSpentCheck"]);
                checksOutcome.push(checker(qualityCheckData["goldChecks"]));
                qualityCheckData["globalOutcome"] = checker(checksOutcome);
                let qualityChecksPayload =
                    this.buildQualityChecksPayload(qualityCheckData);
                await this.dynamoDBService.insertDataRecord(
                    this.configService.environment,
                    this.worker,
                    this.task,
                    qualityChecksPayload
                );

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
                    this.conversationState = ConversationState.Task;
                    // Reinizializzo
                    for (let i = 0; i < this.task.documents.length; i++) {
                        document.getElementById(i.toString()).className =
                            "dot to-complete";
                    }
                    this.cleanUserInput();
                    this.typing.nativeElement.style.display = "none";
                    this.buttonsToShow = ButtonsType.None;
                    this.ignoreMsg = true;
                    this.dimensionIndex = 0;
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
                this.readOnly = true;
                //Messaggio finale

                let finalMessage: string = `Oh! That was it! Thank you for completing the task! &#x1F609; Here's your token: <b> ${this.task.tokenOutput}`;
                this.typingAnimation(finalMessage);
                this.typingAnimation(
                    "You may now close the page or leave a comment!"
                );

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
                        this.messagesForUser[this.messagesForUser.length - 1];

                    modalRef.result.then(async (result) => {
                        if (result) {
                            let comment = this.buildCommentPayload(result);

                            await this.dynamoDBService.insertDataRecord(
                                this.configService.environment,
                                this.worker,
                                this.task,
                                comment
                            );
                        }
                    });
                }, 2000);
            } else {
                return;
            }
        }
    }

    private initializeConversation() {
        if (!this.conversationInitialized && !!this.userName) {
            this.initializeChatbotExpressions();
            if (this.userName != "!NONAME")
                this.typingAnimation(this.messagesForUser[2]);
            else {
                this.typingAnimation(this.messagesForUser[3]);
            }
            this.buttonsToShow = ButtonsType.YesNo;
            return;
        }
        if (this.conversationInitialized) {
            //Check della presenza di questionari nel task
            if (this.questionnaireAnswers.length > 0) {
                this.typingAnimation("First, a few questions about yourself!");
                setTimeout(() => {
                    /* The task is now started and the worker is looking at the first questionnaire, so the first start timestamp is saved */
                    this.timestampsStart[this.currentQuestionnaire].push(
                        ChatHelper.getTimeStampInSeconds()
                    );
                    this.questionnaireP("0");
                }, 3000);
            } else {
                this.skipQuestionnairePhase();
            }
        } else {
            this.typingAnimation(this.messagesForUser[0]);
            this.typingAnimation(this.messagesForUser[1]);
            this.readOnly = false;
            return;
        }
    }

    private skipQuestionnairePhase() {
        this.inputComponentToShow = InputType.Text;
        this.conversationState = ConversationState.TaskInstructions;
        setTimeout(() => {
            this.instructionP();
        }, 2000);
    }

    //Controlla se il questionario è finito e avvia la fase di revisione del questionario
    private checkIfQuestionnaireIsFinished() {
        let isFinished = false;
        if (this.currentQuestionnaire >= this.task.questionnaires.length) {
            isFinished = true;
        }
        return isFinished;
    }

    private checkInputAnswer(message, taskIndex, dimensionIndex) {
        if (this.waitForUrl) {
            if (!ChatHelper.urlValid(message)) {
                this.typingAnimation(
                    "Please type or select a valid url, try using the search bar on the right!"
                );
                return false;
            }
            this.answers[taskIndex][dimensionIndex].urlValue = message;
            //Caricamento delle risposte del documento revisionato
            this.storeDimensionSelected(
                taskIndex,
                dimensionIndex,
                null,
                message
            );
        }
        //E' una dimensione con doppio input
        else if (this.hasDoubleInput) {
            if (
                !this.getAnswerValidity(dimensionIndex, message, this.urlValue)
            ) {
                this.typingAnimation(
                    "Check your answers, please type or select a valid url, you can use the search bar on the right!"
                );

                return false;
            }

            this.hasDoubleInput = false;
            this.answers[taskIndex][dimensionIndex].urlValue = this.urlValue;
            this.answers[taskIndex][dimensionIndex].dimensionValue = message;
            this.storeDimensionSelected(
                taskIndex,
                dimensionIndex,
                message,
                this.urlValue
            );

            this.cleanUserInput();
            this.ignoreMsg = true;
        } else if (message != "startTask" && !this.ignoreMsg) {
            if (
                !ChatHelper.validMsg(message, this.minValue, this.maxValue) &&
                this.inputComponentToShow != InputType.Text
            ) {
                let messageToSend = "";
                if (this.inputComponentToShow == InputType.Number) {
                    messageToSend = `Please type a integer number higher than ${this.minValue} `;
                } else {
                    messageToSend = `Please type a integer number between ${this.minValue} and ${this.maxValue}`;
                }
                this.typingAnimation(messageToSend);
                return false;
            }
            //E' una dimensione testuale libera
            else if (this.inputComponentToShow == InputType.Text) {
                if (!!message.trim()) {
                    this.answers[taskIndex][dimensionIndex].dimensionValue =
                        message;
                    this.storeDimensionSelected(
                        taskIndex,
                        dimensionIndex,
                        message,
                        null
                    );
                } else {
                    this.typingAnimation("Please insert a text...");
                    return false;
                }
            } else {
                this.answers[this.taskIndex][dimensionIndex].dimensionValue =
                    message;
                this.storeDimensionSelected(
                    taskIndex,
                    dimensionIndex,
                    message,
                    null
                );

                this.cleanUserInput();
            }
        } else if (message == "startTask") {
            return false;
        }

        this.cleanUserInput();
        this.ignoreMsg = true;
        return true;
    }

    //Configurazione del countdown
    private setCountdown() {
        const { settings } = this.task;
        // salvare il valore corrente dell'observable
        let countdownValue = settings.countdown_time;
        this.countdownValueSubject.next(countdownValue);
        this.timerIsOverSubject.next(false);

        this.progress = countdownValue / 100;
        this.showCountdown = true;
        const progressBarEl = this.progressBar.nativeElement;
        progressBarEl.style.width = this.progress.toString() + "%";
        this.countdownTimeStartContainer.push(
            ChatHelper.getTimeStampInSeconds()
        );
        this.activeInterval = setInterval(() => {
            countdownValue--;
            this.countdownValueSubject.next(countdownValue);
            if (countdownValue == 0) {
                progressBarEl.style.width = "100%";
                this.timerIsOverSubject.next(true);
                this.storeCountdownData();
                clearInterval(this.activeInterval);
            } else {
                progressBarEl.display = "block";
                this.progress =
                    100 - (countdownValue * 100) / settings.countdown_time;
                if (this.progress > 0 && this.progress < 100) {
                    progressBarEl.style.width = this.progress.toString() + "%";
                }
            }
        }, 1000);
    }

    private emitGetUrlValue() {
        this.readUrlValue.emit();
    }

    public updateUrlValue($event) {
        this.urlValue = $event;
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
        this.urlInputValue = "";
        this.textInputPlaceHolder = "";
        this.inputComponentToShow = InputType.Text;
        this.waitForUrl = false;
        this.emitDisableSearchEngine();
        this.emitResetSearchEngineState();
    }

    //Salvataggio delle row selezionate
    public getUrl(row) {
        if (this.hasDoubleInput) {
            this.urlInputValue = row.url;
            this.emitGetUrlValue();
        } else {
            this.textInputPlaceHolder = row.url;
        }
        let q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.dimensionIndex;
        q["query"] = this.queryRetrieved.length;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = ChatHelper.getTimeStampInSeconds();
        q["response"] = row;
        this.querySelectedUrls.push(q);
        return;
    }

    public storeSearchEngineRetrievedResponse(resp) {
        let q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.dimensionIndex;
        q["query"] = this.queryRetrieved.length;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = ChatHelper.getTimeStampInSeconds();
        q["response"] = resp;

        this.queryRetrieved.push(q);
    }

    public storeSearchEngineUserQuery(text) {
        this.textInputPlaceHolder = "";
        this.readOnly = false;
        let q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.dimensionIndex;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = ChatHelper.getTimeStampInSeconds();
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
        const typingTime =
            this.simulateTypingTime(message) * this.queue < 800
                ? 800
                : this.simulateTypingTime(message) * this.queue;
        setTimeout(() => {
            this.addMessage(this.operator, message, "received");
            this.changeDetector.detectChanges();
            this.scrollToBottom();
        }, this.queue * typingTime); // modifica speed
    }
    //Fa scrollare la chat infondo
    private scrollToBottom() {
        if (this.chatbody !== undefined) {
            if (
                this.chatbody.nativeElement.scrollHeight >
                this.chatbody.nativeElement.clientHeight
            ) {
                this.chatbody.nativeElement.scrollIntoView();
            }
        }
    }
    private simulateTypingTime(input: string): number {
        // Calcola il tempo di base per ogni carattere digitato (in millisecondi)
        const baseTypingTime = 50;

        // Calcola il tempo aggiuntivo in base alla lunghezza della stringa
        const extraTypingTime = input.length * 10;

        // Restituisci il tempo totale di digitazione (in millisecondi)
        return (baseTypingTime * input.length + extraTypingTime) / 1000;
    }

    // Invio un messaggio random
    public randomMessage() {
        this.typingAnimation(
            ChatHelper.getRandomMessage(
                this.randomMessagesFirstPart,
                this.randomMessagesSecondPart
            )
        );
    }

    private initializeChatbotExpressions() {
        let replaceString;
        replaceString = this.userName == "!NONAME" ? "" : this.userName;
        this.messagesForUser = this.messagesForUser.map((str) =>
            str.replace("{name}", replaceString)
        );
        this.randomMessagesFirstPart = this.randomMessagesFirstPart.map((str) =>
            str.replace("{name}", replaceString)
        );
        this.randomMessagesSecondPart = this.randomMessagesSecondPart.map(
            (str) => str.replace("{name}", replaceString)
        );
    }

    public showInstructions() {
        const modalRef = this.ngModal.open(ChatInstructionModalComponent, {
            size: "lg",
        });
        modalRef.componentInstance.instructions = this.task.instructionsGeneral;
        modalRef.componentInstance.instructionsEvaluation =
            this.task.instructionsEvaluation;
    }

    //Stampa della domanda nella chat
    private printQuestion() {
        this.accessesAmount[this.currentQuestion] += 1;
        let q =
            this.task.questionnaires[this.currentQuestionnaire].questions[
                this.currentQuestion
            ].text;
        this.typingAnimation(q);
        return;
    }

    private printExampleStatement() {
        //Composizione messaggio dell'agente conversazionale

        this.typingAnimation(
            "I will show you a statement and ask you a question about it, please select the correct answer at the bottom of this chat."
        );
        let messageToSend =
            "Statement: <b>" +
            this.exampleStatement.statement_text +
            "</b> <br>";
        messageToSend += "- " + this.exampleStatement.speaker_name;
        messageToSend += " " + this.exampleStatement.statement_date;
        this.typingAnimation(messageToSend);
        //Composizione messaggio fissato
        this.fixedMessage = this.exampleStatement["statement_text"];
        this.statementAuthor = this.exampleStatement["speaker_name"];
        this.statementDate = this.exampleStatement["statement_date"];
    }

    // Stampa lo statement corrente e lo fissa nella chat
    private printStatement() {
        const { hit } = this.task;
        this.accessesAmount[
            this.task.questionnaires.length + this.taskIndex
        ] += 1;

        document.getElementById(this.taskIndex.toString()).className =
            "dot in-progress";
        let messageToSend =
            "Statement: <b>" +
            hit.documents[this.taskIndex]["statement_text"] +
            "</b> ";
        if (!!hit.documents[this.taskIndex]["speaker_name"])
            messageToSend +=
                "- " + hit.documents[this.taskIndex]["speaker_name"];
        if (!!hit.documents[this.taskIndex]["statement_date"])
            messageToSend +=
                " " + hit.documents[this.taskIndex]["statement_date"];
        this.typingAnimation(messageToSend);
        //Composizione messaggio fissato
        if (!!this.fixedMessage) {
        } else {
            if (!!hit.documents[this.taskIndex]["statement_text"])
                this.fixedMessage =
                    hit.documents[this.taskIndex]["statement_text"];

            if (!!hit.documents[this.taskIndex]["speaker_name"])
                this.statementAuthor =
                    hit.documents[this.taskIndex]["speaker_name"];

            if (!!hit.documents[this.taskIndex]["statement_date"])
                this.statementDate =
                    hit.documents[this.taskIndex]["statement_date"];
        }
    }

    // Stampa la dimensione corrente
    private printDimension(taskIndex: number, dimensionIndex: number) {
        const { dimensions } = this.task;
        let out = "";
        out += "Please rate the <b>";
        if (!!dimensions[dimensionIndex].name_pretty) {
            out += dimensions[dimensionIndex].name_pretty;
        } else {
            out += dimensions[dimensionIndex].name;
        }
        out += "</b> of the statement.<br>";
        if (!!dimensions[dimensionIndex].description) {
            out += dimensions[dimensionIndex].description;
        }
        if (!!this.answers[taskIndex][dimensionIndex].dimensionValue) {
            out += "You previously answered<br>";
            if (!!dimensions[dimensionIndex].url) {
                out +=
                    "Url: <b>" +
                    this.answers[taskIndex][dimensionIndex].urlValue +
                    "</b><br>";
            }
            if (
                !!dimensions[dimensionIndex].scale &&
                dimensions[dimensionIndex].scale.type == "categorical"
            ) {
                out +=
                    "Dimension value: <b>" +
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
        const { dimensions } = this.task;
        let recap = "";
        for (let i = 0; i < this.task.dimensionsAmount; i++) {
            let scaleType = null;
            recap += i + 1 + ". ";

            //Dimensioni con doppio input
            if (dimensions[i].scale && !!dimensions[i].url) {
                scaleType = dimensions[i].scale.type;
                recap +=
                    "<b> URL</b>: " +
                    this.answers[taskIndex][i].urlValue +
                    "<br>";
                if (dimensions[i].name_pretty) {
                    recap += "<b>" + dimensions[i].name_pretty + "</b>: ";
                }
                switch (scaleType) {
                    case "categorical":
                        recap +=
                            this.getCategoricalAnswerLabel(
                                i,
                                this.answers[taskIndex][i].dimensionValue
                            ) + "<br>";

                        break;
                    case "magnitude_estimation":
                    case "interval":
                    case "textual":
                        recap +=
                            this.answers[taskIndex][i].dimensionValue + "<br>";
                        break;
                    default:
                        console.warn("Casistica non gestita");
                        break;
                }
            }
            // Dimensioni con singolo input
            else {
                if (!dimensions[i].scale && !!dimensions[i].url) {
                    scaleType = "url";
                } else if (dimensions[i].justification) {
                    scaleType = "textual";
                } else {
                    scaleType = dimensions[i].scale.type;
                }
                //Costruzione del prefisso alla risposta
                if (scaleType == "url") {
                    recap += "<b> URL</b>: ";
                } else {
                    if (dimensions[i].name_pretty) {
                        recap += "<b>" + dimensions[i].name_pretty + "</b>: ";
                    } else {
                        recap += "<b>Dimension</b>: ";
                    }
                }
                switch (scaleType) {
                    case "url":
                        recap += this.answers[taskIndex][i].urlValue + "<br>";
                        break;
                    case "categorical":
                        recap +=
                            this.getCategoricalAnswerLabel(
                                i,
                                this.answers[taskIndex][i].dimensionValue
                            ) + "<br>";
                        break;
                    case "magnitude_estimation":
                    case "interval":
                    case "textual":
                        recap +=
                            this.answers[taskIndex][i].dimensionValue + "<br>";
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
    private createStatementsRecap() {
        const { hit } = this.task;
        let statements = "";
        for (let i = 0; i < hit.documents.length; i++) {
            statements +=
                "<b> Statement " +
                (i + 1) +
                "</b>: " +
                hit.documents[i]["statement_text"] +
                " <br> - " +
                hit.documents[i]["speaker_name"] +
                ", ";
            if (!!hit.documents[i]["statement_date"])
                statements += hit.documents[i]["statement_date"];
            statements += "<br>";
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

    private createLikertQuestionnaireAnswers() {
        let l = this.task.questionnaires[this.currentQuestionnaire].mappings;
        let recap = "";
        for (let i = 0; i < l.length; i++) {
            recap += i + 1 + ". <b>" + l[i].label + "</b><br><br>";
        }
        recap += "Please select an answer";
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
                } else if (
                    questionnaire.type == "crt" ||
                    questionnaire.type == "likert"
                ) {
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
    private selectDimensionToGenerate(index) {
        const { dimensions } = this.task;
        this.showMessageInput = true;
        this.readOnly = true;
        let scaleType = null;

        if (dimensions[index].url && !!dimensions[index].scale) {
            this.hasDoubleInput = true;
            this.emitEnableSearchEngine();

            this.typingAnimation(
                "Please use the search bar on the right to search for information about the truthfulness of the statement. Once you find a suitable result, please type or select its url"
            );
            if (!!dimensions[index].scale)
                scaleType = dimensions[index].scale.type;
        } else {
            if (!dimensions[index].scale && dimensions[index].url) {
                scaleType = "url";
            } else if (dimensions[index].justification) {
                scaleType = "textual";
            } else {
                scaleType = dimensions[index].scale.type;
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
                this.generateCategoricalAnswers(index);

                break;
            case "magnitude_estimation":
                this.generateMagnitudeAnswer(index);

                break;
            case "interval":
                this.generateIntervalAnswer(index);

                break;
            case "textual":
                this.generateTextualAnswer(index);
                break;
            default:
                console.warn("Casistica non gestita");
                break;
        }
        if (
            scaleType != "url" &&
            this.inputComponentToShow != InputType.Button
        ) {
            this.readOnly = false;
        }
        this.statementProvided = true;
        this.timestampsStart[
            this.task.questionnaires.length + this.taskIndex
        ][0] = ChatHelper.getTimeStampInSeconds();
        this.changeDetector.detectChanges();
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
        if (this.conversationState === ConversationState.QuestionnaireReview) {
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
                        label:
                            (index + 1).toString() +
                            ". " +
                            (dimension.name_pretty ?? "Dimension"),

                        value: (index + 1).toString(),
                    };
                }
            );
        }
        this.inputComponentToShow = InputType.Dropdown;
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

    private generateLikertQuestionnaireAnswers() {
        this.dropdownListOptions = this.task.questionnaires[
            this.currentQuestionnaire
        ].mappings.map((el) => ({
            label: el.label,
            value: el.value,
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
    private generateExampleDimension() {
        let out = `Please rate the <b> ${this.exampleStatement.dimensionInfo.name} </b> of the statement.`;

        this.typingAnimation(out);

        this.categoricalInfo = [];
        const dimensionInfos = this.exampleStatement.dimensionInfo;
        this.dropdownListOptions = (
            dimensionInfos.scale as ScaleCategorical
        ).mapping.map((dimension) => {
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

        this.showMessageInput = false;
        this.readOnly = false;
        this.inputComponentToShow = InputType.Dropdown;
    }

    private generateCategoricalAnswers(dimensionIndex: number) {
        this.categoricalInfo = [];
        const dimensionInfos = this.task.dimensions[dimensionIndex];
        //Se una dimensione ha più di 5 valori mappati oppure si prevede un doppio input appare la DDL
        if (
            (dimensionInfos.scale as ScaleCategorical).mapping.length > 2 ||
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
            this.inputComponentToShow = InputType.Dropdown;
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

            this.inputComponentToShow = InputType.Button;
        }
        //Va a fissare il valore massimo e minimo per la validazione della risposta che verrà fornita
        this.minValue = ChatHelper.getCategoricalMinInfo(this.categoricalInfo);
        this.maxValue = ChatHelper.getCategoricalMaxInfo(this.categoricalInfo);
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
        this.inputComponentToShow = InputType.Slider;
    }
    private generateTextualAnswer(dimensionIndex: number) {
        this.textInputPlaceHolder = null;
        this.inputComponentToShow = InputType.Text;
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
        this.inputComponentToShow = InputType.Number;
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
    private getDropdownAnswerValue(message) {
        const mappedValue = this.dropdownListOptions.find(
            (el) => el.label.toLowerCase() == message.toLowerCase()
        );
        if (!!mappedValue) return mappedValue.value;
        else return null;
    }

    private getFinalRevisionAnswerValue(message: string) {
        return +message.split(" ")[1] - 1;
    }
    private getInstructions(): string {
        let instructions = "";
        if (this.task.instructionsGeneral.length > 0) {
            this.task.instructionsGeneral.forEach((item) => {
                instructions +=
                    (item.caption
                        ? "<strong>" + item.caption + "</strong> </br>"
                        : "") +
                    item.text +
                    "</br>";
            });
        }
        return instructions;
    }

    private getAnswerValidity(
        dimensionIndex: number,
        message: string,
        url: string
    ): boolean {
        const { dimensions } = this.task;
        let isValid = false;
        if (
            !!dimensions[dimensionIndex].scale &&
            !!dimensions[dimensionIndex].url
        ) {
            isValid =
                ChatHelper.validMsg(message, this.minValue, this.maxValue) &&
                ChatHelper.urlValid(url);
        } else if (this.waitForUrl) {
            isValid = ChatHelper.urlValid(url);
        } else if (dimensions[dimensionIndex].justification) {
            isValid = true;
        } else
            isValid = ChatHelper.validMsg(
                message,
                this.minValue,
                this.maxValue
            );

        return isValid;
    }

    private storeDimensionSelected(
        taskIndex: number,
        dimensionIndex: number,
        value: string,
        url: string
    ) {
        let dimSel = {};
        dimSel["document"] = taskIndex;
        dimSel["dimension"] = dimensionIndex;
        dimSel["index"] = this.dimensionSelected.length;
        dimSel["timestamp"] = ChatHelper.getTimeStampInSeconds();
        dimSel["value"] = value ?? null;
        dimSel["url"] = url ?? null;
        this.dimensionSelected.push(dimSel);
    }

    private getGlobalQuestionIndex(
        currentQuestionnaire,
        currentQuestion
    ): number {
        let globalQuestionIndex = 0;
        this.task.questionnaires.forEach((questionnaire, index) => {
            if (index < currentQuestionnaire)
                globalQuestionIndex += questionnaire.questions.length;
        });
        globalQuestionIndex = globalQuestionIndex + currentQuestion;

        return globalQuestionIndex;
    }

    private getLocalQuestionIndexByGlobalIndex(globalIndex): number {
        var index = 0;
        while (globalIndex > this.task.questionnaires[index].questions.length) {
            globalIndex -= this.task.questionnaires[index].questions.length;
            if (globalIndex > 0) index++;
        }
        if (globalIndex > 0) {
            globalIndex--;
        }

        return globalIndex;
    }

    private getQuestionnaireIndexByQuestionGlobalIndex(globalIndex): number {
        let index = 0;
        while (globalIndex > this.task.questionnaires[index].questions.length) {
            globalIndex -= this.task.questionnaires[index].questions.length;
            if (globalIndex > 0) index++;
        }
        return index;
    }

    private resetCountdown() {
        this.showCountdown = false;
        clearInterval(this.activeInterval);
    }

    /* -- MODELLAZIONE E INVIO DATI AL SERVIZIO DI STORAGE -- */
    //Salvataggio informazione relativa alla scadenza del countdown
    private storeCountdownData() {
        if (this.conversationState == ConversationState.Task)
            this.task.countdownsExpired[this.taskIndex] = true;
    }
    //Invio dei dati relativi al questionario
    private async uploadQuestionnaireData(questionnaireIdx: number) {
        let answers = this.buildQuestionnaireAnswersData(questionnaireIdx);
        let questionnairePayload = this.buildTaskQuestionnairePayload(
            questionnaireIdx,
            answers,
            this.action
        );
        await this.dynamoDBService.insertDataRecord(
            this.configService.environment,
            this.worker,
            this.task,
            questionnairePayload
        );
        this.task.sequenceNumber += 1;
    }
    //Modellazione delle risposte del questionario
    private buildQuestionnaireAnswersData(questionnaireIndex: number) {
        let addOn = "_answer";
        let questionnaireData = {};
        let startIndex = this.getQuestionnaireStartIndex(questionnaireIndex);
        this.task.questionnaires[questionnaireIndex].questions.length - 1;
        this.task.questionnaires[questionnaireIndex].questions.forEach(
            (question) => {
                questionnaireData[question.name + addOn] =
                    this.questionnaireAnswers[startIndex];
                startIndex++;
            }
        );

        return questionnaireData;
    }

    private getQuestionnaireStartIndex(questionnaireIndex): number {
        let startIndex = 0;
        if (questionnaireIndex == 0) {
        } else {
            for (let index = 0; index < questionnaireIndex; index++) {
                startIndex += this.task.questionnaires[index].questions.length;
            }
        }

        return startIndex;
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
    private async uploadDocumentData(docIndex) {
        let answers = this.buildAnswerDataFormat(docIndex);
        let documentPayload = this.buildTaskDocumentPayload(
            docIndex,
            answers,
            null,
            this.action
        );
        await this.dynamoDBService.insertDataRecord(
            this.configService.environment,
            this.worker,
            this.task,
            documentPayload
        );

        this.task.sequenceNumber += 1;
        this.query = [];
        this.queryRetrieved = [];
        this.querySelectedUrls = [];
    }
    //Modellazione delle risposte da salvare
    private buildAnswerDataFormat(docIndex) {
        const { dimensions } = this.task;
        let answers = {};
        let addOn = "_value";
        for (let i = 0; i < dimensions.length; i++) {
            if (!!dimensions[i].scale) {
                answers[dimensions[i].name + addOn] =
                    this.answers[docIndex][i].dimensionValue;
            }
            if (!!dimensions[i].url) {
                answers[dimensions[i].name + "_url"] =
                    this.answers[docIndex][i].urlValue;
            }
        }
        return answers;
    }
    public buildTaskDocumentPayload(documentIndex, answers, countdown, action) {
        let data = {};
        let currentElementIndex =
            this.task.questionnaires.length + documentIndex;
        /* Info about the performed action  */
        data["info"] = {
            action: action,
            access: this.accessesAmount[currentElementIndex],
            try: this.task.tryCurrent,
            index: documentIndex,
            sequence: this.task.sequenceNumber,
            element: "document",
        };
        /* Worker's answers for the current document */
        data["answers"] = answers ?? [];
        data["notes"] = [];

        /* Worker's dimensions selected values for the current document */
        let dimensionSelectedValues = {};
        dimensionSelectedValues["data"] = this.dimensionSelected;
        dimensionSelectedValues["amount"] = this.dimensionSelected.length;
        data["dimensions_selected"] = dimensionSelectedValues;

        /* Worker's search engine queries for the current document */
        let queriesInfo = {};
        queriesInfo["data"] = this.query;
        queriesInfo["amount"] = this.query.length;
        data["queries"] = queriesInfo;

        /* Start, end and elapsed timestamps for the current document */
        data["timestamps_start"] =
            this.timestampsStart[currentElementIndex] ?? [];
        data["timestamps_end"] = this.timestampsEnd[currentElementIndex] ?? [];
        data["timestamps_elapsed"] =
            this.timestampsElapsed[currentElementIndex] ?? 0;
        /* Countdown time and corresponding flag */
        data["countdowns_times_start"] = !!this.countdownTimeStartContainer[
            documentIndex
        ]
            ? [this.countdownTimeStartContainer[documentIndex]]
            : [];
        data["countdowns_times_left"] = !!this.countdownLeftTimeContainer[
            documentIndex
        ]
            ? [this.countdownLeftTimeContainer[documentIndex]]
            : [];
        data["countdowns_expired"] =
            this.task.countdownsExpired.length > 0
                ? this.task.countdownsExpired[documentIndex]
                : [];

        /* Number of accesses to the current document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
        data["accesses"] = this.accessesAmount[currentElementIndex] ?? 0;

        /* Responses retrieved by search engine for each worker's query for the current document */
        let queryRetrievedData = {};
        queryRetrievedData["data"] = this.queryRetrieved;
        let number = 0;
        for (let i = 0; i < this.queryRetrieved.length; i++) {
            number += this.queryRetrieved[i]["response"].length;
        }
        queryRetrievedData["amount"] = number;
        queryRetrievedData["groups"] = queryRetrievedData["data"].length;
        data["responses_retrieved"] = queryRetrievedData ?? {
            data: [],
            amount: 0,
        };

        /* Responses by search engine ordered by worker's click for the current document */
        let responsesSelectedData = {};
        responsesSelectedData["data"] = this.querySelectedUrls;
        responsesSelectedData["amount"] = responsesSelectedData["data"].length;
        data["responses_selected"] = responsesSelectedData ?? {
            data: [],
            amount: 0,
        };

        return data;
    }
    private taskQualityCheck(): boolean {
        for (let goldDocument of this.task.goldDocuments) {
            let currentConfiguration = {};
            currentConfiguration["document"] = goldDocument;
            let answers = {};
            //Si estrae il nome della gold dimension e il relativo valore salvato nelle answers
            for (let goldDimension of this.task.goldDimensions) {
                answers[goldDimension.name] = [];
                // Per ogni gold dimension si estrae il valore tra le risposte
                this.answers.forEach((element) => {
                    answers[goldDimension.name].push(
                        element[goldDimension.index]
                    );
                });
            }
            currentConfiguration["answers"] = answers;
            currentConfiguration["notes"] = [];
            this.goldConfiguration.push(currentConfiguration);
        }

        /* The gold configuration is evaluated using the static method implemented within the GoldChecker class */
        this.goldChecks = GoldChecker.performGoldCheck(this.goldConfiguration);
        return;
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

    public taskTimeCheck(): boolean {
        let timeSpentCheck = true;
        let timeCheckAmount = this.task.settings.time_check_amount;
        this.timestampsElapsed.forEach((item) => {
            if (item < timeCheckAmount) timeSpentCheck = false;
        });
        return timeSpentCheck;
    }

    public performGlobalValidityCheck(): boolean {
        //Tutti i dati sono inseriti presenti, condizione garantito dall'algoritmo che gestisce il flow
        return true;
    }

    public buildQualityChecksPayload(qualityChecks) {
        let checks = {};
        checks["info"] = {
            try: this.tryNumber,
            sequence: this.task.sequenceNumber,
            element: "checks",
        };
        checks["checks"] = qualityChecks;
        return checks;
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
