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
import {fadeIn} from "../animations";
import {NgxUiLoaderService} from "ngx-ui-loader";
import {S3Service} from "../../../services/aws/s3.service";
import {DynamoDBService} from "../../../services/aws/dynamoDB.service";
import {SectionService, StatusCodes} from "../../../services/section.service";
import {ConfigService} from "../../../services/config.service";
/* Models */
import {Task} from "../../../models/skeleton/task";
import {
    AnswerModel,
    CategoricalInfo,
    DropdownSelectItem,
    InputType,
    ConversationState,
    IntervalDimensionInfo,
    MagnitudeDimensionInfo,
    ButtonsType,
    QuestionType,
} from "../../../models/conversational/common.model";
import {ScaleCategorical} from "../../../models/skeleton/dimension";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {GoldChecker} from "data/build/skeleton/goldChecker";
import ChatHelper from "./chat-helpers";
import {BehaviorSubject, Observable} from "rxjs";
import {ChatCommentModalComponent} from "../chat-modals/chat-comment-modal/chat-comment-modal.component";
import {ChatInstructionModalComponent} from "../chat-modals/chat-instruction-modal/chat-instruction-modal.component";
import {Worker} from "../../../models/worker/worker";

// Main
@Component({
    selector: "chat-widget",
    templateUrl: "./chat-widget.component.html",
    styleUrls: ["./chat-widget.component.scss"],
    animations: [fadeIn],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ChatWidgetComponent implements OnInit {
    @ViewChild("chatbody") chatbody!: ElementRef;
    @ViewChild("typing", {static: true}) typing!: ElementRef;
    @ViewChild("inputBox", {static: true}) inputBox!: ElementRef;
    @ViewChild("progressBar", {static: true}) progressBar!: ElementRef;

    // Search engine events
    resetSearchEngine: EventEmitter<void> = new EventEmitter<void>();
    disableSearchEngine: EventEmitter<boolean> = new EventEmitter<boolean>();
    readUrlValue: EventEmitter<void> = new EventEmitter<void>();

    @Input() public worker: Worker;
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

    dimensionSelected: {}[];
    queryTotal: {}[];
    responsesRetrievedTotal: {}[];
    responsesSelectedTotal: {}[];
    query: {}[];
    queryRetrieved: {}[];
    querySelectedUrls: {}[];

    // Flag
    ignoreMsg: boolean; // True: ignora i messaggi in input
    statementProvided: boolean; // True: ho già mostrato allo statement durante questa fase
    reviewAnswersShown: boolean; // True: la review delle risposte è stata mostrata
    pickReview: boolean; // True: stiamo attendendo input per modificare una dimension
    dimensionReviewPrinted: boolean;
    statementJump: boolean; // True: siamo nella fase di salto degli statement
    waitForUrl: boolean; // True: stiamo attendendo un url
    awaitingAnswer: boolean;
    action: string;
    readOnly = true;
    canSend = true;
    queryIndex: number[];
    sendData = false;
    conversationState: ConversationState;

    // Variables
    fixedMessage: string; // Messaggio sempre visibile in alto nel chatbot
    statementAuthor: string;
    statementDate: string;
    answers: AnswerModel[][] = []; //
    questionnaireAnswers: any[] = [];
    queue: number;
    textInputPlaceHolder: string;
    urlInputValue: string;
    accessesAmount: number[]; //Numero di accessi agli elementi
    public conversationInitialized = false;
    public finishedExampleActivity = false;
    public urlValue = "";
    private minValue: number = -2; //Valore validazione estremo inferiore
    private maxValue: number = +2; //Valore validazione estremo superirore

    // Countdown
    public countdownValue: Observable<number>; //Valore in secondi
    private countdownValueSubject = new BehaviorSubject<number>(0);
    private progress: number; // Percentuale di completamento della barra del timer
    public timerIsOver: Observable<boolean>; //Flag countdown scaduto
    private timerIsOverSubject = new BehaviorSubject<boolean>(false);
    // Interval per la gestione del countdown
    private activeInterval: any;
    public showCountdown = false; //Interval per la gestione del countdown
    private countdownLeftTimeContainer = [];
    private countdownTimeStartContainer = [];

    // Quality check
    private goldConfiguration = [];
    private goldChecks = [];
    public showMessageInput = true;

    // Show components flag
    public EnInputType = InputType;
    public inputComponentToShow: InputType = InputType.Text;

    public buttonsToShow = ButtonsType.None;
    public enButtonType = ButtonsType;
    public hasDoubleInput = false;
    public questionType: QuestionType = QuestionType.None;

    // Containers
    public categoricalInfo: CategoricalInfo[] = [];
    public magnitudeInfo: MagnitudeDimensionInfo = null;
    public intervalInfo: IntervalDimensionInfo = null;
    public dropdownListOptions: DropdownSelectItem[] = [];
    public buttonOptions: DropdownSelectItem[] = [];
    public guid: string = null;
    public toReplace = null;

    // Messaggi per l'utente
    public messagesForUser = [
        "Hello &#x1F60A<br>My name is Crowdbot and I'll be helping you complete this task! You can find the <b>instructions</b> near my name, at the top of this chat: just click the question mark whenever you need. Nothing will break down, I promise! &#x1F609;",
        "What's your name? If you don't want to tell me your name just write <b>no</b> in the chat and click send",
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

    // Info worker
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
        name: "Crowd Bot",
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

                    text: "Evaluate the Overall Truthfulness on your evaluation of the statement",
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
        const {documents, questionnaires, settings, dimensions} = this.task;

        this.countdownTimeStartContainer = !!settings.countdownTime
            ? Array(documents.length).fill(settings.countdownTime)
            : [];
        this.countdownLeftTimeContainer = !!settings.countdownTime
            ? Array(documents.length).fill(0)
            : [];

        this.task.initializeAccessCounter();
        this.task.initializeTimestamps();

        this.accessesAmount = this.task.elementsAccesses;
        this.timestampsStart = this.task.timestampsStart;
        this.timestampsEnd = this.task.timestampsEnd;
        this.timestampsElapsed = this.task.timestampsElapsed;

        this.queryIndex = Array(documents.length).fill(0);
        this.questionnaireAnswers = Array(
            ChatHelper.getTotalElements(questionnaires, "questions")
        ).fill("");
        this.answers = Array.from({length: documents.length}, () =>
            Array.from({length: dimensions.length}, () => ({
                dimensionValue: null,
            }))
        );

    }


    ngOnInit() {
        const random = Math.floor(Math.random() * 9);
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
        this.textInputPlaceHolder = null;
        this.urlInputValue = "";
        this.query = [];
        this.queryRetrieved = [];
        this.querySelectedUrls = [];
        this.dimensionSelected = [];
        this.queryTotal = [];
        this.responsesSelectedTotal = [];
        this.responsesRetrievedTotal = [];
        this.action = "Next";

        // Countdown
        this.countdownValue = this.countdownValueSubject.asObservable();
        this.timerIsOver = this.timerIsOverSubject.asObservable();
        this.progress = 0;

        // Dimensionamento dei vettori relativi ai documenti, le dimensioni e le risposte
        this.initializeContainers();
        // Disabilito il motore di ricerca
        this.emitDisableSearchEngine();

        // PRIMO INVIO DATI ALL'AVVIO
        const data = {};

        const actionInfo = {
            try: this.task.tryCurrent,
            sequence: this.task.sequenceNumber,
            element: "data",
        };
        const taskData = {
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
    public sendMessage({message}) {
        if (this.conversationInitialized) {
            if (this.ignoreMsg) return;
            if (this.hasDoubleInput) {
                this.emitGetUrlValue();
            }
            message = !!message.label ? message.label : message;
            if (this.hasDoubleInput) {
                this.addMessageClient(
                    this.client,
                    {url: this.urlValue, value: message},
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
                    const isFinished = this.questionnaireP(message);
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
            if (message.toLowerCase() == "yes" && this.userName != undefined) {
                this.buttonsToShow = ButtonsType.None;
                this.changeDetector.detectChanges();
                this.conversationInitialized = true;
                this.ignoreMsg = true;
                this.initializeConversation();
            } else {
                // Controlla se al worker è stato chiesto il nome
                if (!this.userName) {
                    if (message.toLowerCase() != "no") {
                        // capitalizzazione del nome
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
        const {questionnaires} = this.task;
        // È in attesa di una risposta?
        if (this.awaitingAnswer) {
            if (
                this.inputComponentToShow == InputType.Number &&
                !ChatHelper.validMsg(message, 1, 100)
            ) {
                this.typingAnimation(
                    "Please type a integer number between 1 and 100"
                );
                return false;
            } else {
                this.textInputPlaceHolder = null;
                const questionType = this.getQuestionnaireType(
                    this.currentQuestionnaire
                );
                let replacement =
                    this.printQuestion(
                        this.currentQuestion,
                        this.currentQuestionnaire
                    ) + "<br/>";
                switch (questionType) {
                    case QuestionType.Likert:
                        message = this.getLikertMapping(
                            this.currentQuestionnaire,
                            message,
                            "value"
                        );
                        replacement += this.generateQuestionnaireOptions(true);
                        this.replaceMessage(replacement);
                        break;
                    case QuestionType.Standard:
                        replacement += this.generateQuestionnaireOptions(false);
                        this.replaceMessage(replacement);
                        break;
                    default:
                        // Nessuna operazione
                        break;
                }
                this.questionnaireAnswers[
                    this.getGlobalQuestionIndex(
                        this.currentQuestionnaire,
                        this.currentQuestion
                    )
                    ] = message;
                this.inputComponentToShow = InputType.Text;
                this.canSend = true;
                this.currentQuestion++;
                this.awaitingAnswer = false;
                if (
                    this.currentQuestion >=
                    questionnaires[this.currentQuestionnaire].questions.length
                ) {
                    this.timestampsEnd[this.currentQuestionnaire].push(
                        ChatHelper.getTimeStampInSeconds()
                    );

                    // Calcolo tempo trascorso tra il completamento di due questionari
                    this.timestampsElapsed[this.currentQuestionnaire] =
                        this.timestampsEnd[this.currentQuestionnaire][0] -
                        this.timestampsStart[this.currentQuestionnaire][0];
                    this.uploadQuestionnaireData(this.currentQuestionnaire);
                    this.currentQuestion = 0;
                    const dotEl = document.getElementById(
                        this.currentQuestionnaire.toString()
                    );
                    if (dotEl) dotEl.className = "dot completed";
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
        const dotEl = document.getElementById(
            this.currentQuestionnaire.toString()
        );
        if (dotEl) dotEl.className = "dot in-progress";
        // Non è in attesa, quindi genera la domanda successiva
        this.showMessageInput = true;
        this.ignoreMsg = false
        if (questionnaires[this.currentQuestionnaire].type == "standard") {
            this.createQuestionnaireAnswers(
                this.printQuestion(
                    this.currentQuestion,
                    this.currentQuestionnaire
                )
            );

        } else if (questionnaires[this.currentQuestionnaire].type == "likert") {
            this.typingAnimation(
                questionnaires[this.currentQuestionnaire].questions[
                    this.currentQuestion
                    ].text
            );
            this.createQuestionnaireAnswers(
                this.printQuestion(
                    this.currentQuestion,
                    this.currentQuestionnaire
                ),
                true
            );

        } else if (questionnaires[this.currentQuestionnaire].type == "crt") {
            this.readOnly = false;
            this.typingAnimation(
                questionnaires[this.currentQuestionnaire].questions[
                    this.currentQuestion
                    ].text
            );
            this.inputComponentToShow = InputType.Number;
            setTimeout(() => {
                this.showMessageInput = false;
                this.changeDetector.detectChanges();
            }, 1600);
        }
        this.awaitingAnswer = true;
        return false;
    }

    // Fase di istruzioni
    private instructionP(message?: any) {
        this.ignoreMsg = true;
        if (!this.finishedExampleActivity && !message) {
            const instruction = this.getInstructions();
            this.typingAnimation(instruction);
            this.typingAnimation(this.messagesForUser[7]);
            setTimeout(() => {
                this.ignoreMsg = false;
                this.buttonsToShow = ButtonsType.YesNo;
                this.changeDetector.detectChanges();
            }, 1600);
            return;
        } else {
            // Se non ho generato il messaggio di prova
            if (!this.finishedExampleActivity && !this.fixedMessage) {
                if (message.toLowerCase() == "yes") {
                    this.buttonsToShow = ButtonsType.None;
                    this.printExampleStatement();
                    this.generateExampleDimension();
                } else if (message.toLowerCase() == "no") {
                    this.buttonsToShow = ButtonsType.None;
                    this.typingAnimation(this.messagesForUser[11]);
                    this.inputComponentToShow = InputType.Text;
                    this.canSend = true;
                    setTimeout(() => {
                        this.conversationState = ConversationState.Task;
                        this.action = "Next";
                        this.taskP("startTask");
                    }, 1600);
                    return;
                } else {
                    this.ignoreMsg = false;
                    return;
                }
            } else if (!this.finishedExampleActivity && this.fixedMessage) {
                this.textInputPlaceHolder = null;
                const answerMessage = `You answered <b>${message}</b>, ${message.toLowerCase() === "true"
                    ? "that's exactly the right answer, great!"
                    : "I understand, but I thought it was true... maybe I'm wrong."
                }`;
                this.typingAnimation(answerMessage);
                this.typingAnimation(this.messagesForUser[10]);

                let replacement = `Please evaluate the <b> ${this.exampleStatement.dimensionInfo.name} </b> of the statement.<br>`;
                const option = this.exampleStatement.dimensionInfo.scale.mapping;
                for (let i = 0; i < option.length; i++) {
                    replacement +=
                        i + 1 + ". " + option[i].label + "<br>";
                }
                this.replaceMessage(replacement);
                this.finishedExampleActivity = true;
                this.fixedMessage = null;
                this.showMessageInput = true;
                this.statementDate = null;
                this.statementAuthor = null;
                this.categoricalInfo = [];
                this.dropdownListOptions = [];
                this.inputComponentToShow = InputType.Text;
                this.canSend = true;
                setTimeout(() => {
                    this.conversationState = ConversationState.Task;
                    this.action = "Next";
                    this.taskP("startTask");
                }, 3000);
            }
        }
    }

    // Fase di task
    private taskP(message) {
        const {settings, dimensions} = this.task;
        let dimension = dimensions[this.dimensionIndex];
        let isValid = true;
        if (
            this.inputComponentToShow == InputType.Dropdown ||
            this.inputComponentToShow == InputType.Button
        ) {
            message = this.getCategoricalMapping(
                message,
                this.dimensionIndex,
                "value"
            );
        }
        // È l'ultima dimensione dello statement?
        if (
            this.dimensionIndex == this.task.dimensionsAmount - 1 &&
            this.getAnswerValidity(this.dimensionIndex, message, this.urlValue)
        ) {
            // Stop del interval
            if (!!settings.countdownTime) {
                this.storeCountdownData(
                    this.taskIndex,
                    settings.countdownTime,
                    this.countdownValueSubject.value
                );
                this.showCountdown = false;
            }
            // Salvo il tempo di fine
            this.timestampsEnd[this.task.questionnaires.length + this.taskIndex][0] =
                ChatHelper.getTimeStampInSeconds();
            this.checkInputAnswer(message, this.taskIndex, this.dimensionIndex);

            if (dimension.scale && dimension.scale.type == "categorical") {
                let out = "";
                if (dimension.name_pretty) {
                    out = dimension.name_pretty + "<br>";
                } else {
                    out = `Please evaluate the <b>${ChatHelper.capitalize(
                        dimension.name
                    )}</b><br>`;
                }
                if (!!dimension.description) {
                    out += dimension.description + "<br>";
                }
                const options = (
                    dimension.scale as ScaleCategorical
                ).mapping.map((scale) => scale.label);
                out += options
                    .map((option, i) => `${i + 1}. ${option}<br>`)
                    .join("");
                this.replaceMessage(out);
            }
            this.statementProvided = false;
            this.reviewAnswersShown = false;
            this.conversationState = ConversationState.TaskReview;
            this.reviewP(message);
            return;
        } else {
            isValid = this.checkInputAnswer(
                message,
                this.taskIndex,
                this.dimensionIndex
            );
            if (isValid) {
                if (dimension.scale && dimension.scale.type == "categorical") {
                    let out = "";
                    if (dimension.name_pretty) {
                        out = "<b>" + dimension.name_pretty + "</b><br>";
                    } else {
                        out = `Please evaluate the <b>${ChatHelper.capitalize(
                            dimension.name
                        )}</b><br>`;
                    }
                    if (!!dimension.description) {
                        out += dimension.description + "<br>";
                    }
                    const options = (
                        dimension.scale as ScaleCategorical
                    ).mapping.map((scale) => scale.label);
                    out += options
                        .map((option, i) => `${i + 1}. ${option}<br>`)
                        .join("");
                    this.replaceMessage(out);
                }
                this.dimensionIndex++;
                dimension = dimensions[this.dimensionIndex];
                this.inputComponentToShow = InputType.Text;
                this.canSend = true;
            }
        }
        // Visualizzazione dello statement
        if (!this.fixedMessage) {
            this.printStatement();
        }
        // Visualizzazione della dimensione
        if (!!this.fixedMessage) {
            if (!!settings.countdownTime && this.dimensionIndex == 0) {
                this.setCountdown(settings.countdownTime);
            }
            if (isValid || message == "startTask") {
                this.printDimension(this.taskIndex, this.dimensionIndex);
                setTimeout(() => {
                    if (this.inputComponentToShow !== InputType.Button) {
                        this.showMessageInput = false;
                    }
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
        const {questionnaires, dimensions} = this.task;
        if (
            !this.dimensionReviewPrinted &&
            this.inputComponentToShow == InputType.Dropdown
        ) {
            message = this.getDropdownAnswerValue(message);
        }
        // Modifica di un questionario
        if (this.conversationState === ConversationState.QuestionnaireReview) {
            if (this.pickReview) {
                // È in attesa della risposta da parte dell'utente
                if (this.awaitingAnswer) {
                    const questionType = this.getQuestionnaireType(
                        this.currentQuestionnaire
                    );
                    this.textInputPlaceHolder = null;
                    if (questionType == QuestionType.CRT) {
                        if (!ChatHelper.validMsg(message, 1, 100)) {
                            this.typingAnimation(
                                "Please type a integer number between 1 and 100"
                            );
                            return;
                        }
                    }
                    const globalIndex = this.getGlobalQuestionIndex(
                        this.currentQuestionnaire,
                        this.currentQuestion
                    );

                    let replacement =
                        this.printQuestion(
                            this.currentQuestion,
                            this.currentQuestionnaire
                        ) + "<br/>";
                    switch (questionType) {
                        case QuestionType.Likert:
                            replacement +=
                                this.generateQuestionnaireOptions(true);
                            this.replaceMessage(replacement);
                            break;
                        case QuestionType.Standard:
                            replacement +=
                                this.generateQuestionnaireOptions(false);
                            this.replaceMessage(replacement);
                            break;
                        default:
                            // Nessuna operazione
                            break;
                    }
                    if (questionType == QuestionType.Likert) {
                        this.questionnaireAnswers[globalIndex] = questionnaires[
                            this.currentQuestionnaire
                            ].mappings.find((el) => el.label == message).value;
                    } else {
                        this.questionnaireAnswers[globalIndex] = message;
                    }

                    const dotEl = document.getElementById(
                        this.currentQuestionnaire.toString()
                    );
                    if (dotEl) dotEl.className = "dot completed";
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
                    // Revisione della domanda
                    const globalQuestionIndex = +message;
                    // Viene calcolato il questionario di appartenenza della domanda e l'indice relativo alla domanda
                    this.currentQuestionnaire =
                        this.getQuestionnaireIndexByQuestionGlobalIndex(
                            globalQuestionIndex
                        );
                    this.currentQuestion =
                        this.getLocalQuestionIndexByGlobalIndex(
                            globalQuestionIndex
                        );

                    const dotEl2 = document.getElementById(
                        this.currentQuestionnaire.toString()
                    );
                    if (dotEl2) dotEl2.className = "dot in-progress";
                    this.awaitingAnswer = true;
                    this.inputComponentToShow = InputType.Text;
                    this.canSend = true;
                    const questionType = this.getQuestionnaireType(
                        this.currentQuestionnaire
                    );
                    switch (questionType) {
                        case QuestionType.Likert:
                            this.readOnly = true;
                            this.showMessageInput = true;
                            this.createQuestionnaireAnswers(
                                this.printQuestion(
                                    this.currentQuestion,
                                    this.currentQuestionnaire
                                ),
                                true
                            );

                            return;
                        case QuestionType.Standard:
                            this.createQuestionnaireAnswers(
                                this.printQuestion(
                                    this.currentQuestion,
                                    this.currentQuestionnaire
                                )
                            );

                            return;
                        case QuestionType.CRT:
                            this.printQuestion(
                                this.currentQuestion,
                                this.currentQuestionnaire
                            );
                            this.inputComponentToShow = InputType.Number;
                            return;
                        default:
                            this.buttonsToShow = ButtonsType.None;
                            return;
                    }
                }
            }
            if (!this.reviewAnswersShown) {
                this.cleanUserInput();
                this.typingAnimation("Let's review your answers!");
                this.typingAnimation(this.createQuestionnaireRecap());
                this.typingAnimation("Do you confirm your answers?");
                this.readOnly = false;
                this.reviewAnswersShown = true;
                setTimeout(() => {
                    this.buttonsToShow = ButtonsType.Confirm;
                    this.changeDetector.detectChanges();
                }, 2400);

                return;
            }
            // Confermo le risposte del questionario
            if (message.trim().toLowerCase() === "confirm") {
                this.inputComponentToShow = InputType.Text;
                this.canSend = true;
                this.buttonsToShow = ButtonsType.None;

                // Preparazione fase delle istruzioni
                this.taskIndex = 0;
                this.dimensionIndex = 0;
                this.reviewAnswersShown = false;
                this.ignoreMsg = true;
                this.conversationState = ConversationState.TaskInstructions;
                this.awaitingAnswer = false;
                this.pickReview = false;
                this.typingAnimation(this.messagesForUser[5]);
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
                // La risposta fornita non è valida, si rimane in attesa
                return;
            }
        }
        // Modifica di una dimensione
        if (this.pickReview) {
            const dimension = dimensions[this.dimensionIndex];
            // La dimensione è visualizzata
            if (this.dimensionReviewPrinted) {
                // Check risposta con doppio input
                if (
                    this.inputComponentToShow == InputType.Dropdown ||
                    this.inputComponentToShow == InputType.Button
                ) {
                    message = this.getCategoricalMapping(
                        message,
                        this.dimensionIndex,
                        "value"
                    );
                }
                const isValid = this.checkInputAnswer(
                    message,
                    this.taskIndex,
                    this.dimensionIndex
                );
                if (isValid) {
                    if (dimension.scale?.type === "categorical") {
                        let out = "";
                        if (dimension.name_pretty) {
                            out = "<b>" + dimension.name_pretty + "</b><br>";
                        } else {
                            out = `Please evaluate the <b>${ChatHelper.capitalize(
                                dimension.name
                            )}</b><br>`;
                        }
                        if (!!dimension.description) {
                            out += dimension.description + "<br>";
                        }
                        const options = (
                            dimension.scale as ScaleCategorical
                        ).mapping.map((scale) => scale.label);
                        out += options
                            .map(
                                (option, i) => `${i + 1}. ${option}<br>`
                            )
                            .join("");
                        this.replaceMessage(out);
                    }
                    this.inputComponentToShow = InputType.Text;
                    this.canSend = true;
                    if (
                        this.task.settings.countdownTime !== null &&
                        this.task.settings.countdownTime !== undefined
                    ) {
                        const startTime =
                            this.action === "Back"
                                ? this.countdownLeftTimeContainer[
                                    this.taskIndex
                                    ]
                                : this.task.settings.countdownTime;
                        this.storeCountdownData(
                            this.taskIndex,
                            startTime,
                            this.countdownValueSubject.value
                        );
                        this.showCountdown = false;
                    }
                } else return;
            } else {
                this.cleanUserInput();
                // Faccio scegliere quale dimensione visualizzare
                if (
                    !ChatHelper.validMsg(message, 1, this.task.dimensionsAmount)
                ) {
                    const messageToSend = `Please type a integer number between 1 and ${this.task.dimensionsAmount}`;
                    this.typingAnimation(messageToSend);
                    return;
                }
                this.dimensionIndex = +message;
                if (this.dimensionIndex > 0) this.dimensionIndex--;

                this.printDimension(this.taskIndex, this.dimensionIndex);
                this.dimensionReviewPrinted = true;
                this.selectDimensionToGenerate(this.dimensionIndex);
                if (!!this.task.settings.countdownTime) {
                    this.setCountdown(
                        this.countdownLeftTimeContainer[this.taskIndex]
                    );
                }
                if (this.inputComponentToShow != InputType.Button)
                    this.showMessageInput = false;
                return;
            }
            this.cleanUserInput();
            // Reset della fase di revisione
            this.reviewAnswersShown = false;
            this.pickReview = false;
        }

        // Ripeto questa fase finché non ricevo un Confirm
        if (!this.reviewAnswersShown) {
            this.cleanUserInput();
            this.typingAnimation("Let's review your answers!");
            this.typingAnimation(this.createDocumentRecap(this.taskIndex));
            this.typingAnimation("Do you confirm your answers?");

            setTimeout(() => {
                this.buttonsToShow = ButtonsType.Confirm;
                this.changeDetector.detectChanges();
            }, 2400);
            this.reviewAnswersShown = true;
            return;
        } // Conferma le risposte dell'assignment
        if (message.trim().toLowerCase() === "confirm") {
            this.inputComponentToShow = InputType.Text;
            this.canSend = true;
            this.buttonsToShow = ButtonsType.None;

            const currentElementIndex =
                this.task.questionnaires.length + this.taskIndex;
            this.timestampsEnd[currentElementIndex][0] =
                ChatHelper.getTimeStampInSeconds();
            this.timestampsElapsed[currentElementIndex] =
                this.timestampsEnd[currentElementIndex][0] -
                this.timestampsStart[currentElementIndex][0];
            this.uploadDocumentData(this.taskIndex);

            // Il documento viene contrassegnato come completato
            const el = document.getElementById(
                (this.task.questionnaires.length + this.taskIndex).toString()
            );
            if (el) el.className = "dot completed";
            // Se era l'ultimo statement, passo alla fase finale
            if (
                this.task.hit.documents.length - 1 <= this.taskIndex ||
                this.statementJump
            ) {
                this.cleanUserInput();
                this.statementJump = false;
                this.reviewAnswersShown = false;
                this.conversationState = ConversationState.End;
                this.fixedMessage = null;
                this.typingAnimation(
                    "OK! Would you like to jump to a specific statement?"
                );

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
            // this.action = "Back";
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
    /* =========================
   ChatWidgetComponent
   ========================= */

    private async endP(message) {
        /* If we are in "jump to statement" mode, resolve and go to TaskReview. */
        if (this.statementJump) {
            this.getDropdownAnswerValue(message);
            this.taskIndex = this.getFinalRevisionAnswerValue(message);
            this.dimensionIndex = 0;
            this.printStatement();
            this.conversationState = ConversationState.TaskReview;
            if (this.task.settings.countdownTime) {
                this.resetCountdown();
            }
            this.reviewAnswersShown = false;
            this.reviewP(message);
            return;
        }

        /* Otherwise respond to the final decision (jump or finish). */
        const msg = message.trim().toLowerCase();
        if (msg === "yes") {
            /* Prepare the “jump to specific statement” flow. */
            this.action = "Back";
            this.showMessageInput = false;
            this.buttonsToShow = ButtonsType.None;
            this.typingAnimation(this.createStatementsRecap());
            this.typingAnimation("Which statement would you like to jump to?");
            this.generateFinalStatementRecapData();
            this.inputComponentToShow = InputType.Dropdown;
            this.statementJump = true;
            return;
        }

        if (msg !== "no") {
            /* Any answer different from yes/no is ignored at this point. */
            return;
        }

        /* =========
           FINISH FLOW
           ========= */

        /* Switch to finish action and advance sequence for the final records. */
        this.inputComponentToShow = InputType.Text;
        this.buttonsToShow = ButtonsType.None;
        this.action = "Finish";
        this.task.sequenceNumber += 1;

        /* Rebuild gold/time checks and compute global outcome. */
        this.taskQualityCheck();
        const timeSpentCheck = this.task.timeSpentOk();
        const qualityCheckData = {
            globalOutcome: null as boolean | null,
            globalFormValidity: true,
            timeSpentCheck: timeSpentCheck,
            goldChecks: this.goldChecks,
            goldConfiguration: this.goldConfiguration,
        };
        const checker = (arr: boolean[]) => arr.every(Boolean);
        qualityCheckData.globalOutcome = checker([
            qualityCheckData.globalFormValidity,
            qualityCheckData.timeSpentCheck,
            checker(qualityCheckData.goldChecks),
        ]);

        /* Persist the quality-checks payload. */
        const qualityChecksPayload = this.task.buildQualityChecksPayload(qualityCheckData);
        await this.dynamoDBService.insertDataRecord(
            this.configService.environment,
            this.worker,
            this.task,
            qualityChecksPayload
        );

        /* Update base ACL fields before writing status. */
        this.worker.setParameter("time_completion", new Date().toUTCString());

        if (qualityCheckData.globalOutcome === true) {
            /* --------------------
               SUCCESSFUL COMPLETION
               -------------------- */
            this.worker.setParameter("in_progress", String(false));
            this.worker.setParameter("paid", String(true));

            /* Typed status write using StatusCodes enum. */
            await this.dynamoDBService.updateWorkerAcl(
                this.configService.environment,
                this.worker,
                StatusCodes.TASK_SUCCESSFUL
            );

            /* Final success UX. */
            this.readOnly = true;
            this.typingAnimation(`Oh! That was it! Thank you for completing the task! &#x1F609;`);
            this.typingAnimation(`Here's your input token: <b>${this.task.tokenInput}</b>`);
            this.typingAnimation(`And this is your output token: <b>${this.task.tokenOutput} </b>`);
            this.typingAnimation("You may now close the page or leave a comment!");

            /* Ask for an optional comment in a modal, then log it as a data record. */
            setTimeout(() => {
                const modalRef = this.ngModal.open(ChatCommentModalComponent, {size: "md"});
                modalRef.componentInstance.inputToken = this.task.tokenInput;
                modalRef.componentInstance.outputToken = this.task.tokenOutput;
                modalRef.componentInstance.inMessage = "Thanks for finishing the task, this is your input token:";
                modalRef.componentInstance.outMessage = "and this is your output token:";

                modalRef.result.then(async (result) => {
                    if (result) {
                        const comment = this.task.buildCommentPayload(result);
                        await this.dynamoDBService.insertDataRecord(
                            this.configService.environment,
                            this.worker,
                            this.task,
                            comment
                        );
                    }
                });
            }, 2000);

            return;
        }

        /* -------------
           FAILURE BRANCH
           ------------- */

        /* Increment try counters and decide next status. */
        this.task.tryCurrent += 1;
        const triesLeft = this.task.settings.allowed_tries - this.task.tryCurrent;

        this.worker.setParameter("try_left", String(triesLeft));
        this.worker.setParameter("try_current", String(this.task.tryCurrent));
        this.worker.setParameter("paid", String(false));

        const hasTries = triesLeft > 0;
        this.worker.setParameter("in_progress", String(hasTries));

        /* Typed status write using StatusCodes enum. */
        const status = hasTries ? StatusCodes.TASK_FAILED_WITH_TRIES : StatusCodes.TASK_FAILED_NO_TRIES;
        await this.dynamoDBService.updateWorkerAcl(this.configService.environment, this.worker, status);

        /* If no tries left, stop here and inform the worker. */
        if (!hasTries) {
            this.typingAnimation("Sorry, you are not eligible for completing this task. Please close this page.");
            this.ignoreMsg = true;
            return;
        }

        /* Otherwise, reset the conversation state and start again. */
        this.typingAnimation("Failure! Let's try again");
        this.conversationState = ConversationState.Task;

        /* Reset the “dot” UI state for all documents. */
        for (let i = 0; i < this.task.documents.length; i++) {
            const el = document.getElementById((this.task.questionnaires.length + i).toString());
            if (el) el.className = "dot to-complete";
        }

        /* Reset chat I/O state. */
        this.cleanUserInput();
        this.typing.nativeElement.style.display = "none";
        this.buttonsToShow = ButtonsType.None;
        this.ignoreMsg = true;

        /* Reset indices and flags for a fresh attempt. */
        this.dimensionIndex = 0;
        this.taskIndex = 0;
        this.dimensionReviewPrinted = false;
        this.reviewAnswersShown = false;
        this.pickReview = false;
        this.statementJump = false;
        this.awaitingAnswer = false;
        this.statementProvided = false;

        /* Re-enter the Task flow. */
        this.taskP({value: "startTask"});
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
            // Check della presenza di questionari nel task
            if (this.questionnaireAnswers.length > 0) {
                this.ignoreMsg = true;
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
        this.typingAnimation(this.messagesForUser[4]);
        this.inputComponentToShow = InputType.Text;
        this.canSend = true;
        this.conversationState = ConversationState.TaskInstructions;
        setTimeout(() => {
            this.instructionP();
        }, 2000);
    }

    // Controlla se il questionario è finito e avvia la fase di revisione del questionario
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
                    "Please type or select a valid url, try using the search bar below!"
                );
                return false;
            }
            this.answers[taskIndex][dimensionIndex].urlValue = message;
            // Caricamento delle risposte del documento revisionato
            this.storeDimensionSelected(
                taskIndex,
                dimensionIndex,
                null,
                message
            );
        }
        // È una dimensione con doppio input
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
            // È una dimensione testuale libera
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

    // Configurazione del countdown
    private setCountdown(countdownTime: number) {
        const {settings} = this.task;
        // salvare il valore corrente dell'observable
        this.countdownValueSubject.next(countdownTime);
        this.timerIsOverSubject.next(false);

        this.progress = countdownTime / 100;
        const progressBarEl = this.progressBar.nativeElement;
        progressBarEl.style.width = this.progress.toString() + "%";
        this.showCountdown = true;

        this.activeInterval = setInterval(() => {
            countdownTime--;
            this.countdownValueSubject.next(countdownTime);

            if (countdownTime <= 0) {
                progressBarEl.style.width = "100%";
                this.timerIsOverSubject.next(true);
                this.storeCountdownData(this.taskIndex, 0, 0);
                clearInterval(this.activeInterval);
            } else {
                progressBarEl.display = "block";
                this.progress =
                    100 - (countdownTime * 100) / settings.countdownTime;
                if (this.progress > 0 && this.progress < 100) {
                    progressBarEl.style.width = this.progress.toString() + "%";
                }
            }
        }, 1000);
    }

    private getQuestionnaireType(questionnaireIndex) {
        const {questionnaires} = this.task;
        let questionType;
        switch (questionnaires[questionnaireIndex].type) {
            case "crt":
                questionType = QuestionType.CRT;
                break;
            case "likert":
                questionType = QuestionType.Likert;
                break;
            case "standard":
                questionType = QuestionType.Standard;
                break;
            default:
                questionType = QuestionType.None;
                break;
        }
        return questionType;
    }

    private getLikertMapping(index, input, returnValue: "label" | "value") {
        if (returnValue == "label") {
            return this.task.questionnaires[index].mappings.find(
                (el) => el.value == input
            ).label;
        } else {
            return this.task.questionnaires[index].mappings.find(
                (el) => el.label == input
            ).value;
        }
    }

    private replaceMessage(contentForReplacement: string) {
        const index = this.messages.findIndex((el) => el.date == this.toReplace);
        const message = {
            from: {
                avatar: this.operator.avatar,
                name: "Crowd Bot",
                status: "Online",
            },
            text: contentForReplacement,
            type: "received",
            date: this.toReplace,
            isOnlyText: true,
        };
        this.messages[index] = message;
    }

    private emitGetUrlValue() {
        this.readUrlValue.emit();
    }

    public updateUrlValue($event) {
        this.urlValue = $event;
    }

    // Metodi di supporto per il Search Engine
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
        this.textInputPlaceHolder = null;
        this.inputComponentToShow = InputType.Text;
        this.canSend = true;
        this.waitForUrl = false;
        this.emitDisableSearchEngine();
        this.emitResetSearchEngineState();
    }

    // Salvataggio delle row selezionate
    public getUrl(row) {
        if (this.hasDoubleInput) {
            this.urlInputValue = row.url;
            this.emitGetUrlValue();
        } else {
            this.textInputPlaceHolder = row.url;
        }
        const q = {};
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
        const q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.dimensionIndex;
        q["query"] = this.queryRetrieved.length;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = ChatHelper.getTimeStampInSeconds();
        q["response"] = resp;

        this.queryRetrieved.push(q);
    }

    public storeSearchEngineUserQuery(text) {
        this.textInputPlaceHolder = null;
        this.readOnly = false;
        const q = {};
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
            isOnlyText: true,
        });
        this.changeDetector.detectChanges();
        this.scrollToBottom();
    }

    // Aggiunta di un elemento a messages
    public addMessage(
        from: { name: string; status: string; avatar: string; user?: string },
        text: any,
        type: "received" | "sent",
        isOnlyText: boolean = true
    ) {
        // unshift aggiunge elementi all'inizio del vettore
        const timeStamp = new Date().getTime();
        const message = {
            from,
            text,
            type,
            date: timeStamp,
            isOnlyText,
        };
        this.messages.unshift(message);
        if (!isOnlyText) {
            this.toReplace = timeStamp;
        }
        this.queue -= 1;
        if (this.queue == 0) {
            this.typing.nativeElement.style.display = "none"; // Tolgo l'animazione di scrittura
            this.ignoreMsg = false;
        }
        this.changeDetector.detectChanges();
        this.scrollToBottom();
    }

    // Stampa il messaggio inviato dal bot dopo un delay
    public typingAnimation(message: string, isOnlyText: boolean = true) {
        if (message) {
            this.typing.nativeElement.style.display = "block"; // Mostro l'animazione di scrittura
            this.queue += 1;
            this.ignoreMsg = true; // Ignoro i messaggi in arrivo mentre scrivo
            const typingTime =
                this.simulateTypingTime(message) * this.queue < 800
                    ? 800
                    : this.simulateTypingTime(message) * this.queue;
            setTimeout(() => {
                this.addMessage(this.operator, message, "received", isOnlyText);
                this.changeDetector.detectChanges();
                this.scrollToBottom();
            }, this.queue * typingTime); // modifica speed
        }

    }

    // Fa scrollare la chat infondo
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

    // Stampa della domanda nella chat
    private printQuestion(questionIndex: number, questionnaireIndex: number) {
        this.accessesAmount[questionIndex] += 1;
        const q =
            this.task.questionnaires[questionnaireIndex].questions[
                questionIndex
                ].text;
        return q;
    }

    private printExampleStatement() {
        // Composizione messaggio dell'agente conversazionale
        this.typingAnimation(
            "I will show you a statement and ask you a question about it, please select the correct answer."
        );
        let messageToSend =
            "Statement: <b>" +
            this.exampleStatement.statement_text +
            "</b> <br>";
        messageToSend += "- " + this.exampleStatement.speaker_name;
        messageToSend += " " + this.exampleStatement.statement_date;
        this.typingAnimation(messageToSend);
        // Composizione messaggio fissato
        this.fixedMessage = this.exampleStatement["statement_text"];
        this.statementAuthor = this.exampleStatement["speaker_name"];
        this.statementDate = this.exampleStatement["statement_date"];
    }

    // Stampa lo statement corrente e lo fissa nella chat
    private printStatement() {
        const selectedDocument = this.task.documents[this.taskIndex];
        const index = this.task.questionnaires.length + this.taskIndex;
        this.accessesAmount[index] += 1;

        const dotElement = document.getElementById(index.toString());
        if (dotElement) {
            dotElement.className = "dot in-progress";
        }

        const statementText = selectedDocument["statement_text"];
        const speakerName = selectedDocument["speaker_name"];
        const statementDate = selectedDocument["statement_date"];

        let messageToSend = `Statement: <b>${statementText}</b> `;
        if (speakerName) {
            messageToSend += `- ${speakerName}`;
        }
        if (statementDate) {
            messageToSend += ` ${statementDate}`;
        }
        this.typingAnimation(messageToSend);

        if (!this.fixedMessage && statementText) {
            if (speakerName) {
                this.statementAuthor = speakerName;
            }
            if (statementDate) {
                this.statementDate = statementDate;
            }
            this.fixedMessage = statementText;
        }
    }

    // Stampa la dimensione corrente
    private printDimension(taskIndex: number, dimensionIndex: number) {
        const {dimensions} = this.task;
        const dimension = dimensions[dimensionIndex];
        let message = "";

        if (dimension.url && !dimension.scale) {
            message =
                dimension.url?.instructions?.caption ||
                `Please use the search engine on your right to search for <b>${ChatHelper.capitalize(
                    dimension.name
                )}</b> of the statement.`;
        } else if (!dimension.url && dimension.scale?.type === "categorical") {
            // Non stampo la dimensione, perché verrà collegata ai pulsanti
        } else {
            message = dimension.name_pretty
                ? `<b>${dimension.name_pretty}</b><br>`
                : `Please evaluate the <b>${ChatHelper.capitalize(
                    dimension.name
                )}</b><br>`;

            if (dimension.description) {
                message += `${dimension.description}<br>`;
            }

            const answer = this.answers[taskIndex][dimensionIndex];

            if (answer.dimensionValue) {
                message += "You previously answered<br>";

                if (dimension.url) {
                    message += `Url: <b>${answer.urlValue}</b><br>`;
                }

                if (dimension.scale?.type === "categorical") {
                    message += `Dimension value: <b>${this.getCategoricalMapping(
                        dimensionIndex,
                        answer.dimensionValue,
                        "label"
                    )}</b><br>`;
                } else {
                    message += `<br>Dimension value: <b>${answer.dimensionValue}</b>.`;
                }
            }
        }
        this.typingAnimation(message);
    }

    // Creazione del testo relativo alle risposte fornite riguardo allo statement attuale
    private createDocumentRecap(taskIndex) {
        const {dimensions} = this.task;
        let recap = "";
        for (let i = 0; i < this.task.dimensionsAmount; i++) {
            const dimension = dimensions[i];
            const answer = this.answers[taskIndex][i];
            let scaleType = null;
            recap += `${i + 1}. `;

            if (dimension.scale && !!dimension.url) {
                scaleType = dimension.scale.type;
                recap += `URL: ${answer.urlValue}<br>`;
                if (dimension.name_pretty) {
                    recap += `${dimension.name_pretty}: `;
                }
            } else {
                if (!dimension.scale && !!dimension.url) {
                    scaleType = "url";
                } else if (dimension.justification) {
                    scaleType = "textual";
                } else {
                    scaleType = dimension.scale.type;
                }
                if (scaleType === "url") {
                    recap += `URL: `;
                } else {
                    const name =
                        dimension.name_pretty ??
                        ChatHelper.capitalize(dimension.name);
                    recap += `${name}: `;
                }
            }
            recap += "<b>";

            switch (scaleType) {
                case "url":
                    recap += answer.urlValue;
                    break;
                case "categorical":
                    recap += this.getCategoricalAnswerLabel(
                        i,
                        answer.dimensionValue
                    );
                    break;
                case "magnitude_estimation":
                case "interval":
                case "textual":
                    recap += answer.dimensionValue;
                    break;
                default:
                    console.warn("Casistica non gestita");
                    break;
            }
            recap += "</b><br>";
        }
        return recap;
    }

    // Creo una stringa con tutti gli statement
    private createStatementsRecap() {
        const {hit} = this.task;
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

    // Creazione del testo della domanda e delle risposte possibili
    private createQuestionnaireAnswers(
        text: string | undefined,
        isLikert: boolean = false
    ) {
        this.guid = ChatHelper.getUid();
        if (isLikert) {
            const options =
                this.task.questionnaires[this.currentQuestionnaire].mappings;
            this.buttonOptions = options.map((answer) => ({
                label: answer.label,
                value: answer.value,
            }));
        } else {
            this.buttonOptions = this.task.questionnaires[
                this.currentQuestionnaire
                ].questions[this.currentQuestion].answers.map((answer) => ({
                label: answer,
                value: answer,
            }));
        }
        this.typingAnimation(text, false);
        this.readOnly = true;
        this.canSend = false;
        return "";
    }

    private generateQuestionnaireOptions(isLikert: boolean = false): string {
        let recap = "";
        if (isLikert) {
            const options =
                this.task.questionnaires[this.currentQuestionnaire].mappings;
            recap = options
                .map((option, i) => `${i + 1}. ${option.label}<br>`)
                .join("");
        } else {
            const option =
                this.task.questionnaires[this.currentQuestionnaire].questions[
                    this.currentQuestion
                    ].answers;
            recap = option
                .map((answer, i) => `${i + 1}. ${answer}<br>`)
                .join("");
        }
        return recap;
    }

    // Creazione testo di riepilogo del questionario
    private createQuestionnaireRecap() {
        let recap = "";
        let globalQuestionIndex = 1;
        this.task.questionnaires.forEach((item) => {
            for (let i = 0; i < item.questions.length; i++) {
                const questionType = this.getQuestionnaireType(item.index);
                recap +=
                    globalQuestionIndex +
                    ".&nbsp;" +
                    item.questions[i].text +
                    "<br><b>";
                switch (questionType) {
                    case QuestionType.Standard:
                        recap += this.questionnaireAnswers[i] + "</b>";
                        break;
                    case QuestionType.CRT:
                        recap +=
                            this.questionnaireAnswers[globalQuestionIndex - 1] +
                            "</b>";
                        break;
                    case QuestionType.Likert:
                        recap +=
                            this.getLikertMapping(
                                item.index,
                                this.questionnaireAnswers[
                                globalQuestionIndex - 1
                                    ],
                                "label"
                            ) + "</b>";
                        break;
                    default:
                        // Nessuna operazione
                        break;
                }
                recap += "<br>";
                globalQuestionIndex++;
            }
        });

        return recap;
    }

    // Generazione della dimensione in base alla scale type
    private selectDimensionToGenerate(index: number): void {
        const {dimensions} = this.task;
        this.showMessageInput = true;
        this.readOnly = true;

        const selectedDimension = dimensions[index];
        let scaleType = selectedDimension.scale?.type;

        if (selectedDimension.url && scaleType) {
            this.hasDoubleInput = true;
            this.emitEnableSearchEngine();
        } else if (!selectedDimension.scale && selectedDimension.url) {
            scaleType = "url";
        } else if (selectedDimension.justification) {
            scaleType = "textual";
        }

        switch (scaleType) {
            case "url":
                this.waitForUrl = true;
                this.emitEnableSearchEngine();
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
            !["url", "categorical"].includes(scaleType) ||
            this.hasDoubleInput
        ) {
            this.readOnly = false;
        }

        this.statementProvided = true;
        const timestampIndex = this.task.questionnaires.length + this.taskIndex;
        this.timestampsStart[timestampIndex][0] =
            ChatHelper.getTimeStampInSeconds();
        this.changeDetector.detectChanges();
    }

    // Restituisce l'etichetta del valore della relativa dimensione
    private getCategoricalAnswerLabel(dimensionIndex, answerValue) {
        return (
            this.task.dimensions[dimensionIndex].scale as ScaleCategorical
        ).mapping.find((el) => el.value == answerValue).label;
    }

    // Generazione dati per la revisione del questionario o delle dimensioni dello statement
    private generateRevisionData() {
        this.dropdownListOptions = [];
        if (this.conversationState === ConversationState.QuestionnaireReview) {
            let index = 1;
            // Revisione domande dei questionari
            for (const questionnaire of this.task.questionnaires) {
                for (const question of questionnaire.questions) {
                    this.dropdownListOptions.push({
                        label: `${index}. ${question.text}`,
                        value: index.toString(),
                    });
                    index++;
                }
            }
        } else {
            // Revisione dimensioni per ogni statement
            this.dropdownListOptions = this.task.dimensions.map(
                (dimension, index) => ({
                    label: `${index + 1}. ${dimension.name_pretty ||
                    ChatHelper.capitalize(dimension.name)
                    }`,
                    value: (index + 1).toString(),
                })
            );
        }
        this.inputComponentToShow = InputType.Dropdown;
        this.showMessageInput = false;
    }

    private generateFinalStatementRecapData() {
        this.dropdownListOptions = [];
        this.task.hit.documents.forEach((_, index) => {
            this.dropdownListOptions.push({
                label: "Statement " + (index + 1).toString(),
                value: (index + 1).toString(),
            });
        });
    }

    // GENERAZIONE DATI RELATIVI ALLE DIMENSIONI
    private generateExampleDimension() {
        const text = `Please evaluate the <b> ${this.exampleStatement.dimensionInfo.name} </b> of the statement.`;
        const dimensionInfos = this.exampleStatement.dimensionInfo;
        this.buttonOptions = (
            dimensionInfos.scale as ScaleCategorical
        ).mapping.map((el: CategoricalInfo) => ({
            label: el.label,
            value: el.value,
        }));
        this.canSend = false;
        this.readOnly = true;
        this.typingAnimation(text, false);
        this.inputComponentToShow = InputType.Button;
    }

    private generateCategoricalAnswers(dimensionIndex: number) {
        const dimension = this.task.dimensions[dimensionIndex];

        this.categoricalInfo = (
            dimension.scale as ScaleCategorical
        ).mapping.map(({label, description, value}: CategoricalInfo) => ({
            label,
            description,
            value,
        }));

        if (this.hasDoubleInput) {
            this.dropdownListOptions = this.categoricalInfo.map(
                ({label, value}) => ({label, value})
            );
            this.inputComponentToShow = InputType.Dropdown;
        } else {
            this.buttonOptions = this.categoricalInfo.map(
                ({label, value}) => ({label, value})
            );

            let out = "";
            if (dimension.name_pretty) {
                out = "<b>" + dimension.name_pretty + "</b><br>";
            } else {
                out = `Please evaluate the <b>${ChatHelper.capitalize(
                    dimension.name
                )}</b><br>`;
            }

            if (!!dimension.description) {
                out += dimension.description + "<br>";
            }
            this.typingAnimation(out, false);
            this.canSend = false;
            this.inputComponentToShow = InputType.Button;
        }

        this.maxValue = ChatHelper.getCategoricalMaxInfo(this.categoricalInfo);
        this.minValue = ChatHelper.getCategoricalMinInfo(this.categoricalInfo);
    }

    // Generazione delle risposte intervallari
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

    private generateTextualAnswer(_dimensionIndex: number) {
        this.textInputPlaceHolder = null;
        this.inputComponentToShow = InputType.Text;
    }

    // Generazione delle risposte magnitude
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

    // Restituisce il valore mappato della risposta categoriale
    private getCategoricalMapping(
        input,
        index,
        returnValue: "label" | "value"
    ) {
        if (returnValue == "label")
            return (
                this.task.dimensions[index].scale as ScaleCategorical
            ).mapping.find((el) => el.value == input).label;
        else
            return +(
                this.task.dimensions[index].scale as ScaleCategorical
            ).mapping.find((el) => el.label == input).value;
    }

    // Restituisce il valore mappato della Dropdown visualizzata
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
        const {instructionsGeneral} = this.task;
        if (instructionsGeneral.length === 0) {
            return "";
        }
        return instructionsGeneral
            .map((item, index) => {
                const caption = item.caption
                    ? `<strong>${item.caption}</strong><br>`
                    : "";
                const text = item.text;
                const isLast = index === instructionsGeneral.length - 1;
                return `${caption}${text}${isLast ? "" : "<br>"}`;
            })
            .join("");
    }

    private getAnswerValidity(
        dimensionIndex: number,
        message: string,
        url: string
    ): boolean {
        const {dimensions} = this.task;
        const isValueValid = ChatHelper.validMsg(
            message,
            this.minValue,
            this.maxValue
        );
        const isOpenAnswer = dimensions[dimensionIndex].justification;
        let isValid = false;
        if (
            !!dimensions[dimensionIndex].scale &&
            !!dimensions[dimensionIndex].url
        ) {
            isValid = isValueValid && ChatHelper.urlValid(url);
        } else if (this.waitForUrl) {
            isValid = ChatHelper.urlValid(url);
        } else if (isOpenAnswer) {
            isValid = true;
        } else {
            isValid = isValueValid;
        }
        return isValid;
    }

    private storeDimensionSelected(
        taskIndex: number,
        dimensionIndex: number,
        value: string,
        url: string
    ) {
        const dimSel = {};
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
        let index = 0;
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

    // Salvataggio informazione relativa alla scadenza del countdown
    private storeCountdownData(
        documentIndex: number,
        startTime: number,
        leftTime: number
    ) {
        this.countdownTimeStartContainer[documentIndex] = startTime;
        this.countdownLeftTimeContainer[documentIndex] =
            leftTime <= 0 ? 0 : leftTime;
        this.task.countdownsExpired[documentIndex] = leftTime <= 0;
        clearInterval(this.activeInterval);
    }

    /* -- MODELLAZIONE E INVIO DATI AL SERVIZIO DI STORAGE -- */

    // Invio dei dati relativi al questionario
    private async uploadQuestionnaireData(questionnaireIdx: number) {
        const answers = this.buildQuestionnaireAnswersData(questionnaireIdx);

        // Task-style meta
        const meta = this.task.getElementIndex(questionnaireIdx);

        const questionnairePayload = this.task.buildTaskQuestionnairePayload(
            meta,
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


    // Modellazione delle risposte del questionario
    private buildQuestionnaireAnswersData(questionnaireIndex: number) {
        const addOn = "_answer";
        const questionnaireData = {};
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
            // noop
        } else {
            for (let index = 0; index < questionnaireIndex; index++) {
                startIndex += this.task.questionnaires[index].questions.length;
            }
        }
        return startIndex;
    }

    private async uploadDocumentData(docIndex: number) {
        const answers = this.buildAnswerDataFormat(docIndex);

        // Build the element meta the same way Skeleton does
        const overallIndex = this.task.questionnaires.length + docIndex;
        const meta = this.task.getElementIndex(overallIndex);

        // Preserve your chat telemetry
        const responsesAmount = this.queryRetrieved.reduce((sum, g: any) => sum + (g?.response?.length ?? 0), 0);
        const chatExtras = {
            dimensions_selected: {data: this.dimensionSelected, amount: this.dimensionSelected.length},
            queries: {data: this.query, amount: this.query.length},
            responses_retrieved: {data: this.queryRetrieved, amount: responsesAmount, groups: this.queryRetrieved.length},
            responses_selected: {data: this.querySelectedUrls, amount: this.querySelectedUrls.length},
        };

        // If you want to record the live countdown in this payload
        const countdown = this.task.settings.countdownTime
            ? (this.countdownLeftTimeContainer[docIndex] ?? null)
            : null;

        const documentPayload = this.task.buildTaskDocumentPayload(
            meta,
            answers,
            /* additionalAnswers */ {},
            countdown,
            this.action,
            {chatExtras}
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


    // Modellazione delle risposte da salvare
    private buildAnswerDataFormat(docIndex: number) {
        const {dimensions} = this.task;
        const answers = {};
        const addOn = "_value";
        for (let i = 0; i < dimensions.length; i++) {
            const {scale, name, url} = dimensions[i];
            if (scale !== null) {
                answers[name + addOn] =
                    this.answers[docIndex][i].dimensionValue;
            }
            if (url) {
                answers[name + "_url"] = this.answers[docIndex][i].urlValue;
            }
        }
        return answers;
    }

    private taskQualityCheck(): void {
        for (const goldDocument of this.task.goldDocuments) {
            const currentConfiguration = {};
            currentConfiguration["document"] = goldDocument;
            const answers = {};
            // Si estrae il nome della gold dimension e il relativo valore salvato nelle answers
            for (const goldDimension of this.task.goldDimensions) {
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
    }

}
