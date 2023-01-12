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
import { ScaleCategorical } from "src/app/models/skeleton/dimension";
/* Models */
import { Task } from "../../../models/skeleton/task";
import {
    CategoricalInfo,
    EnConversationaTaskStatus,
    IntervalDimensionInfo,
    MagnitudeDimensionInfo,
    McqInfo,
} from "src/app/models/conversational/common.model";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { ChatCommentModalComponent } from "../chat-comment-modal/chat-comment-modalcomponent";

//TODO:
/*
1. Risposte categoriali: Se > 6 far comparire la dropdown
3. Selezionare dimensione di revisione tramite dropdown FATTO, ESTENDERE AI QUESTIONARI 
4. Adeguare il payload alla funzione buildTaskDocumentPayload (task.ts)
6. Se una dimensione ha anche l'URL gestire il doppio INPUT
7. Provare ad implementare il countdown
*/

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

    @ViewChild("fixedMsg", { static: true }) fixedMsg!: ElementRef;
    @ViewChild("typing", { static: true }) typing!: ElementRef;
    @ViewChild("inputBox", { static: true }) inputBox!: ElementRef;

    resetSearchEngine: EventEmitter<void> = new EventEmitter<void>();
    disableSearchEngine: EventEmitter<boolean> = new EventEmitter<boolean>();

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
    indexDimSel: number[];
    goldLow: number;
    goldHigh: number;

    /* Arrays to record timestamps, one for each document within a Hit */
    timestampsStart: Array<Array<number>>;
    timestampsEnd: Array<Array<number>>;
    timestampsElapsed: Array<number>;
    answersPretty: {}[];
    dimensionSelected: {}[];
    queryTotal: {}[];
    responsesRetrievedTotal: {}[];
    responsesSelectedTotal: {}[];
    dimsSelected: {}[];
    query: {}[];
    queryRetrieved: {}[];
    querySelected: {}[];

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
    disableInput = true;
    queryIndex: number[];
    sendData = false;
    taskStatus: EnConversationaTaskStatus;
    // Variables
    fixedMessage: string; // Messaggio sempre visibile in alto nel chatbot
    answers: any[]; // Memorizzo le risposte di un singolo statement
    answersURL: string[]; // Memorizzo gli url
    questionnaireAnswers: any[];
    queue: number;
    buttonsVisibility: number; //0: nulla, 1: YS, 2: CM, 3: Num
    placeholderInput: string;
    tryNumber: number; // Numero di tentativi per completare
    accessesAmount: number[]; //Numero di accessi agli elementi
    minValue: number = -2;
    maxValue: number = +2;

    //show components flag
    showCategoricalAnswers = false;
    showMagnitudeAnswer = false;
    showIntervalAnswer = false;
    showYNbuttons = false;
    showCMbuttons = false;
    showInputDDL = false;

    //containers
    categoricalInfo: CategoricalInfo[] = [];
    magnitudeInfo: MagnitudeDimensionInfo = null;
    intervalInfo: IntervalDimensionInfo = null;
    mcqAnswersInfo: McqInfo[] = [];

    // Commento finale
    modalUserCommentText = "Thanks for finishing the task, this is your token:";
    userCommentOnTask = "";
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
        //inizializzo i vettori
        this.answers = [];
        this.questionnaireAnswers = [];
    }

    private initializeContainers() {
        this.accessesAmount = new Array(this.task.documents.length).fill(0);
        this.indexDimSel = new Array(this.task.documents.length).fill(0);
        this.queryIndex = new Array(this.task.documents.length).fill(0);
        this.answersURL = new Array(this.task.dimensions.length).fill("");
    }

    private getNumberOfQuestionnaireQuestions(): number {
        let numberOfElements = 0;
        this.task.questionnaires.forEach((el) => {
            numberOfElements = +el.questions.length;
        });
        return numberOfElements;
    }

    private setTaskAnswersContainer() {
        this.answers = [];
        for (let i = 0; i < this.task.documents.length; i++) {
            this.answers[i] = [];
            for (let j = 0; j < this.task.dimensionsAmount; j++) {
                this.answers[i][j] = null;
            }
        }
    }

    public operator = {
        name: "Fake News Bot",
        status: "online",
        avatar: "https://randomuser.me/api/portraits/lego/0.jpg",
    };

    public client = {
        name: "Worker",
        user: "test_user",
        status: "online",
        avatar: `https://storage.proboards.com/6172192/images/gKhXFw_5W0SD4nwuMev1.png`,
    };

    public messages: any[] = [];

    async ngOnInit() {
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
        this.tryNumber = 1;
        this.dimsSelected = [];
        this.query = [];
        this.queryRetrieved = [];
        this.querySelected = [];
        this.answersPretty = [];
        this.dimensionSelected = [];
        this.queryTotal = [];
        this.responsesSelectedTotal = [];
        this.responsesRetrievedTotal = [];
        this.action = "Next";

        // Stampo le istruzioni iniziali
        this.typingAnimation(this.instr[0]);
        //Dimensionamento dei vettori relativi alle risposte
        this.setTaskAnswersContainer();
        //Dimensionamento dei vettori relativi ai documenti e le dimensioni
        this.initializeContainers();

        this.questionnaireAnswers = new Array(
            this.getNumberOfQuestionnaireQuestions()
        ).fill("");
        if (this.questionnaireAnswers.length > 0) {
            this.typingAnimation("First, a few questions about yourself!");
            setTimeout(() => this.questionnaireP("0"), 5000);
        } else {
            setTimeout(() => this.skipQuestionnairePhase()), 5000;
            this.taskStatus = EnConversationaTaskStatus.TaskPhase;
        }
        /* Arrays of start, end and elapsed timestamps are initialized to track how much time the worker spends
         * on each document, including each questionnaire */
        this.timestampsStart = new Array<Array<number>>(
            this.task.documentsAmount + this.task.questionnaireAmount
        );
        this.timestampsEnd = new Array<Array<number>>(
            this.task.documentsAmount + this.task.questionnaireAmount
        );
        this.timestampsElapsed = new Array<number>(
            this.task.documentsAmount + this.task.questionnaireAmount
        );
        for (let i = 0; i < this.timestampsStart.length; i++)
            this.timestampsStart[i] = [];
        for (let i = 0; i < this.timestampsEnd.length; i++)
            this.timestampsEnd[i] = [];
        for (let i = 0; i < this.timestampsElapsed.length; i++)
            this.timestampsElapsed[i] = 0;
        /* The task is now started and the worker is looking at the first questionnaire, so the first start timestamp is saved */
        this.timestampsStart[this.currentQuestionnaire].push(Date.now() / 1000);

        this.emitDisableSearchEngine();

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
        //if (this.sendData) await this.dynamoDBService.insertData(this.configService.environment,this.workerID,this.task.unitId, this.tryNumber,this.task.sequenceNumber, data)
        this.task.sequenceNumber += 1;
    }

    // Scrolla in basso
    public scrollToBottom() {
        if (this.bottom !== undefined) {
            this.bottom.nativeElement.scrollIntoView();
        }
    }

    private generateArrayNum(number) {
        let foos = [];
        for (var i = 1; i <= number; i++) {
            foos.push(i.toString());
        }
        return foos;
    }

    private generateCategoricalAnswers(dimensionIndex: number) {
        this.categoricalInfo = [];
        const dimensionInfos = this.task.dimensions[dimensionIndex];
        this.categoricalInfo = (
            dimensionInfos.scale as ScaleCategorical
        ).mapping.map((el: CategoricalInfo) => ({
            label: el.label,
            description: el.description,
            value: el.value,
        }));
        this.minValue = this.getCategoricalMinInfo(this.categoricalInfo);
        this.maxValue = this.getCategoricalMaxInfo(this.categoricalInfo);

        this.showCategoricalAnswers = true;
        this.disableInput = true;
    }

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
        this.showIntervalAnswer = true;
    }

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
        this.showMagnitudeAnswer = true;
    }

    // Utilizzo dei bottoni
    public buttonInput(message: string) {
        this.sendMessage({ message });
    }

    // Controllo che un messaggio abbia valori compresi tra min e max e che sia un numero
    private validMsg(msg, min, max = null) {
        if (max == null) {
            if (isNaN(+msg) || +msg % 1 != 0 || +msg < min) return false;
        } else if (isNaN(+msg) || +msg % 1 != 0 || +msg < min || +msg > max) {
            return false;
        }
        return true;
    }

    private urlValid(msg) {
        let pattern = new RegExp(
            "^(https?:\\/\\/)?" + // protocol
                "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
                "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
                "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
                "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
                "(\\#[-a-z\\d_]*)?$",
            "i"
        ); // fragment locator
        return !!pattern.test(msg);
        //&& ((msg.includes("politifact.com") || (msg.includes("abc.net.au"))) rimosso per il controlo del pattern
        //"politifact.com", "abc.net.au" TODO controlla che siano questi
    }

    // Invio un messaggio random
    public randomMessage() {
        this.typingAnimation(getRandomMessage());
    }

    public updateInputValue(event) {
        this.placeholderInput = event;
        this.disableInput = false;
    }

    private validateTask() {
        let nameArray = [];
        for (let i = 0; i < this.task.hit.documents.length; i++) {
            nameArray[i] = this.task.hit.documents[i]["id"];
        }
        this.goldHigh = nameArray.indexOf("GOLD-HIGH");
        this.goldLow = nameArray.indexOf("GOLD-LOW");
        //Gestione di task che non contengono eventuali Gold questions
        return this.goldHigh == -1 || this.goldLow == -1
            ? true
            : this.answers[this.goldHigh][0] > this.answers[this.goldLow][0];
    }

    // Stampa lo statement corrente e lo setta come messaggio fissato
    private printStatement() {
        this.accessesAmount[this.taskIndex] += 1;
        this.fixedMsg.nativeElement.style.display = "inline-block";
        document.getElementById(
            this.taskIndex.toString()
        ).style.backgroundColor = "#F2452E";
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
            this.fixedMessage = "";
            if (!!this.task.hit.documents[this.taskIndex]["statement_text"])
                this.fixedMessage +=
                    "<b>Statement</b>: " +
                    this.task.hit.documents[this.taskIndex]["statement_text"] +
                    "<br>";
            if (!!this.task.hit.documents[this.taskIndex]["speaker_name"])
                this.fixedMessage +=
                    "<b>Speaker</b>: " +
                    this.task.hit.documents[this.taskIndex]["speaker_name"] +
                    "<br>";
            if (!!this.task.hit.documents[this.taskIndex]["statement_date"])
                this.fixedMessage +=
                    "<b>Date</b>: " +
                    this.task.hit.documents[this.taskIndex]["statement_date"];
        }
    }

    // Stampa la dimensione corrente
    private printDimension(dimensionIndex) {
        let out = "";
        if (this.task.dimensions[dimensionIndex].name_pretty) {
            out =
                "Please rate the <b>" +
                this.task.dimensions[dimensionIndex].name_pretty +
                "</b> of the statement.<br><b>";
            if (!!this.task.dimensions[dimensionIndex].description)
                out +=
                    this.task.dimensions[dimensionIndex].name_pretty +
                    "</b>: " +
                    this.task.dimensions[dimensionIndex].description;
        } else {
            out =
                "Please rate the <b>" +
                this.task.dimensions[dimensionIndex].name +
                "</b> of the statement.<br><b>";
            if (!!this.task.dimensions[dimensionIndex].description)
                out +=
                    this.task.dimensions[dimensionIndex].name_pretty +
                    "</b>: " +
                    this.task.dimensions[dimensionIndex].description;
        }
        if (!!this.answers[this.taskIndex][dimensionIndex]) {
            if (
                this.task.dimensions[dimensionIndex].scale.type == "categorical"
            ) {
                out +=
                    "<br>You previously answered <b>" +
                    this.getCategoricalAnswerLabel(
                        dimensionIndex,
                        this.answers[this.taskIndex][dimensionIndex]
                    ) +
                    "</b>.";
            } else {
                out +=
                    "<br>You previously answered <b>" +
                    this.answers[this.taskIndex][dimensionIndex] +
                    "</b>.";
            }
        }
        this.typingAnimation(out);
    }

    // Creo la stringa con le risposte date allo statement attuale
    private createAnswerString() {
        let recap = "";
        for (let i = 0; i < this.task.dimensionsAmount; i++) {
            let scaleType = null;
            if (!this.task.dimensions[i].scale) {
                scaleType = "url";
            } else {
                scaleType = this.task.dimensions[i].scale.type;
            }
            switch (scaleType) {
                case "url":
                    recap +=
                        i + 1 + ".<b> URL</b>: " + this.answersURL[i] + "<br>";
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
                                this.answers[this.taskIndex][i].toString()
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
                            this.answers[this.taskIndex][i] +
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
                            this.answers[this.taskIndex][i] +
                            " <br>";
                    }
                    break;
                default:
                    console.warn("Casistica non gestita");
                    break;
            }
        }

        return recap;
    }

    private getCategoricalAnswerLabel(dimensionIndex, answerValue) {
        return (
            this.task.dimensions[dimensionIndex].scale as ScaleCategorical
        ).mapping.find((el) => el.value == answerValue).label;
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
                ", " +
                this.task.hit.documents[i]["statement_date"] +
                "<br><br>";
        }
        return statements;
    }

    private createAnswersPretty() {
        let ans = {};
        let addOn = "_value";
        ans["overall-truthfulness" + addOn] = this.answers[this.taskIndex];
        // ans["overall-truthfulness_url"] = this.answersURL[this.taskIndex];
        for (let i = 0; i < this.task.dimensionsAmount; i++) {
            ans[this.task.dimensions[i].name + addOn] =
                this.answers[this.taskIndex][i];
        }
        return ans;
    }

    private createQuestionnaireAnswersPretty() {
        let vect = [];
        let addOn = "_answer";
        for (let y = 0; y < this.task.questionnaireAmount - 1; y++) {
            let ans = {};
            if (y == 0) {
                for (
                    let i = 0;
                    i < this.task.questionnaires[y].questions.length;
                    i++
                ) {
                    ans[this.task.questionnaires[0].questions[i].name + addOn] =
                        this.questionnaireAnswers[i] - 1;
                }
            } else {
                ans[this.task.questionnaires[y].questions[0].name] =
                    this.questionnaireAnswers[
                        this.questionnaireAnswers.length + y
                    ];
            }
            vect.push(ans);
        }
        return vect;
    }

    private async sendQuestionnaireData() {
        let answer = this.createQuestionnaireAnswersPretty();
        for (let i = 0; i < this.task.questionnaireAmount; i++) {
            // SECONDO INVIO DATI ALLA FINE DEL QUESTIONARIO
            let data = {};
            let actionInfo = {
                action: "Next", // nel questionnaire non può tornare indietro
                access: 1,
                try: this.task.tryCurrent,
                index: i, //TODO rivedi che non son sicuro, forse sempre 0?
                sequence: this.task.sequenceNumber,
                element: "questionnaire",
            };
            /* Info about the performed action ("Next"? "Back"? From where?) */
            data["info"] = actionInfo;
            /* Worker's answers to the current questionnaire */
            data["answers"] = answer[i];
            /* Start, end and elapsed timestamps for the current questionnaire */
            data["timestamps_start"] = this.timestampsStart[i];
            data["timestamps_end"] = this.timestampsEnd[i];
            data["timestamps_elapsed"] = this.timestampsElapsed[i];
            /* Number of accesses to the current questionnaire (which must be always 1, since the worker cannot go back */
            data["accesses"] = 1;
            //if (this.sendData) await this.dynamoDBService.insertData(this.configService.environment,this.worker.identifier,this.task.unitId, this.tryNumber,this.task.sequenceNumber,data)
            this.task.sequenceNumber += 1;
        }
    }

    private printQuestion() {
        this.disableInput = true;
        let q =
            this.task.questionnaires[this.currentQuestionnaire].questions[
                this.currentQuestion
            ].text;
        this.typingAnimation(q);
        return;
    }

    private createQuestionnaireAnswers() {
        let l =
            this.task.questionnaires[this.currentQuestionnaire].questions[
                this.currentQuestion
            ].answers;
        let recap = "";
        for (let i = 0; i < l.length; i++) {
            recap += i + 1 + ". <b>" + l[i] + "</b><br><br>";
        }
        recap += "Please type the number associated with the correct answer";
        return recap;
    }

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
                        this.questionnaireAnswers[i].label +
                        // questionnaire.questions[i].answers[
                        //     this.questionnaireAnswers[i] - 1]
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

    public getUrl(row) {
        if (this.waitForUrl) {
            this.placeholderInput = row.url;
        }
        let q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.subTaskIndex;
        q["query"] = this.queryRetrieved.length;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = Date.now() / 1000;
        q["response"] = row;
        this.querySelected.push(q);
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
        this.disableInput = false;
        let q = {};
        q["document"] = this.taskIndex;
        q["dimension"] = this.subTaskIndex;
        q["index"] = this.responsesRetrievedTotal.length;
        q["timestamp"] = Date.now() / 1000;
        q["text"] = text;
        this.query.push(q);
        this.queryIndex[this.taskIndex] += 1;
    }

    // Aggiunta di un messaggio scritto dall'utente a messages
    public addMessageClient(
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

    // Core
    public async sendMessage({ message }) {
        // Se il messaggio è vuoto, ignoro
        if (
            !this.showCategoricalAnswers &&
            !this.showInputDDL &&
            message.trim() === ""
        ) {
            return;
        }
        // Mostro il messaggio in chat
        if (this.showCategoricalAnswers || this.showInputDDL) {
            this.addMessageClient(this.client, message.label, "sent");
        } else {
            this.addMessageClient(this.client, message, "sent");
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
            this.instructionP(message);
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
    private getCategoricalAnswerValue(message) {
        const mappedValue = this.categoricalInfo.find(
            (el) => el.label.toLowerCase() == message.label.toLowerCase()
        );
        if (!!mappedValue) return mappedValue.value;
        else return null;
    }

    private getDimensionAnswerValue(message) {
        const mappedValue = this.mcqAnswersInfo.find(
            (el) => el.label.toLowerCase() == message.label.toLowerCase()
        );
        if (!!mappedValue) return mappedValue.value;
        else return null;
    }

    // Fase di fine task
    private async endP(message) {
        if (this.statementJump) {
            this.taskIndex = +message - 1;
            this.printStatement();
            this.taskStatus = EnConversationaTaskStatus.ReviewPhase;
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
                this.buttonsVisibility = null;
                this.statementJump = true;
            } else if (message.trim().toLowerCase() === "no") {
                this.action = "Next";
                // INVIO DATI ALLA FINE DEL TASK
                let data = {};
                /* All data about documents are uploaded, only once */
                let actionInfo = {
                    action: "Finish",
                    try: this.task.tryCurrent,
                    sequence: this.task.sequenceNumber,
                    element: "all",
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
                    questionnaire_amount_start:
                        this.task.questionnaireAmountStart,
                    questionnaire_amount_end: this.task.questionnaireAmountEnd,
                    documents_amount: this.task.documentsAmount,
                    dimensions_amount: this.task.dimensionsAmount,
                };

                /* Info about each performed action ("Next"? "Back"? From where?) */
                data["info"] = actionInfo;
                data["task"] = taskData;
                data["questionnaires"] = this.task.questionnaires;
                data["documents"] = this.task.documents;
                data["dimensions"] = this.task.dimensions;
                data["worker"] = this.worker;
                data["questionnaires_answers"] =
                    this.createQuestionnaireAnswersPretty();
                data["documents_answers"] = this.answersPretty;
                data["notes"] = [];
                /* Worker's dimensions selected values for the current document */
                data["dimensions_selected"] = this.dimensionSelected;
                /* Start, end and elapsed timestamps for each document */
                data["timestamps_start"] = this.timestampsStart;
                data["timestamps_end"] = this.timestampsEnd;
                data["timestamps_elapsed"] = this.timestampsElapsed;
                /* Countdown time and corresponding flag for each document */
                let countdownTimes = [];
                let countdownTimesStart = [];
                let countdownExpired = [];
                data["countdowns_times_start"] = countdownTimesStart;
                data["countdowns_times_left"] = countdownTimes;
                data["countdowns_expired"] = countdownExpired;
                /* Number of accesses to each document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
                data["accesses"] = this.accessesAmount;
                /* Worker's search engine queries for each document */
                data["queries"] = this.queryTotal;
                /* Responses retrieved by search engine for each worker's query for each document */
                data["responses_retrieved"] = this.responsesRetrievedTotal;
                /* Responses by search engine ordered by worker's click for the current document */
                data["responses_selected"] = this.responsesSelectedTotal;
                /* If the last element is a document */
                //if (this.sendData) await this.dynamoDBService.insertData(this.configService.environment,this.worker.identifier,this.task.unitId, this.tryNumber,this.task.sequenceNumber,data)
                this.task.sequenceNumber += 1;
                // INVIO DATI COL CONTROLLO QUALITA
                let validTry = this.validateTask();
                let goldConfiguration = [];
                let goldH = {};
                let goldL = {};
                //Gestione di task che non contengono eventuali Gold questions
                if (this.goldHigh == -1 || this.goldLow == -1) {
                    let gh = [];
                    gh["index"] = this.goldHigh;
                    let gl = [];
                    gl["index"] = this.goldLow;
                    goldH["document"] = gh;
                    goldL["document"] = gl;
                    let ah = {};
                    ah["overall-truthfulness_value"] = null;
                    ah["overall-truthfulness_url"] = null;
                    let al = {};
                    al["overall-truthfulness_value"] = null;
                    al["overall-truthfulness_url"] = null;
                    goldH["answers"] = ah;
                    goldL["answers"] = al;
                } else {
                    let gh = this.task.hit.documents[this.goldHigh];
                    gh["index"] = this.goldHigh;
                    let gl = this.task.hit.documents[this.goldLow];
                    gl["index"] = this.goldLow;
                    goldH["document"] = gh;
                    goldL["document"] = gl;
                    let ah = {};
                    ah["overall-truthfulness_value"] =
                        this.answers[this.goldHigh][0];
                    // ah["overall-truthfulness_url"] =
                    //     this.answersURL[this.goldHigh];
                    let al = {};
                    al["overall-truthfulness_value"] =
                        this.answers[this.goldLow][0];
                    // al["overall-truthfulness_url"] =
                    //     this.answersURL[this.goldLow];
                    goldH["answers"] = ah;
                    goldL["answers"] = al;
                }
                goldL["notes"] = [];
                goldH["notes"] = [];
                goldConfiguration = [goldL, goldH];
                data = {};
                let actionInfoCheck = {
                    try: this.task.tryCurrent,
                    sequence: this.task.sequenceNumber,
                    element: "checks",
                };
                let qualityCheckData = {
                    globalFormValidity: validTry,
                    timeSpentCheck: "",
                    timeCheckAmount: "",
                    goldChecks: [validTry],
                    goldConfiguration: goldConfiguration,
                };
                data["info"] = actionInfoCheck;
                data["checks"] = qualityCheckData;
                //if (this.sendData) await this.dynamoDBService.insertData(this.configService.environment,this.worker.identifier,this.task.unitId, this.tryNumber,this.task.sequenceNumber,data)
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
                        document.getElementById(
                            i.toString()
                        ).style.backgroundColor = "#3f51b5";
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
                    this.taskP("0");
                    return;
                }
                const modalRef = this.ngModal.open(ChatCommentModalComponent, {
                    size: "md",
                });
                modalRef.componentInstance.outputToken = this.task.tokenOutput;
                modalRef.componentInstance.message = this.modalUserCommentText;

                modalRef.result.then((comment) => {
                    this.userCommentOnTask = comment;
                    this.showYNbuttons = false;
                    this.typingAnimation(this.endOfTaskMessage[0]);
                    this.typingAnimation("You may now close the page!");
                });
            } else {
                return;
            }
        }
    }

    // Fase di istruzioni
    private instructionP(message: string) {
        this.taskStatus = EnConversationaTaskStatus.TaskPhase; // Passiamo alla task phase
        this.ignoreMsg = true;
        this.typingAnimation(
            "I'll now show you some statements and for each one I'll ask you some questions. Please use the search bar on the left to search for info about those statement and answer my questions"
        );
        this.taskP("p");
    }

    // Fase di task
    private async taskP(message: string) {
        if (this.showCategoricalAnswers) {
            message = this.getCategoricalAnswerValue(message);
        }
        if (
            this.subTaskIndex >= this.task.dimensionsAmount &&
            (this.validMsg(message, this.minValue, this.maxValue) ||
                this.urlValid(message))
        ) {
            const subtaskIndex = this.subTaskIndex - 1;
            this.answers[this.taskIndex][subtaskIndex] = message;
            let dimSel = {};
            dimSel["document"] = this.taskIndex;
            dimSel["dimension"] = subtaskIndex;
            dimSel["index"] = this.indexDimSel[this.taskIndex];
            dimSel["timestamp"] = Date.now() / 1000;
            dimSel["value"] = message;
            this.dimsSelected.push(dimSel);
            this.indexDimSel[this.taskIndex] += 1;
            this.statementProvided = false;
            this.taskStatus = EnConversationaTaskStatus.ReviewPhase;
            this.reviewAnswersShown = false;
            this.reviewP(message);
            return;
        }

        if (this.waitForUrl) {
            // Se sto chiedendo l'url
            if (!this.urlValid(message)) {
                this.typingAnimation(
                    "Please type or select a valid url, try using the search bar on the right!"
                );
                return;
            }
            this.answersURL[this.taskIndex] = message;
            //this.answers[this.taskIndex][this.subTaskIndex] = message;
            this.disableInput = false;
            this.cleanUserInput();
            this.placeholderInput = "";
            this.ignoreMsg = true;
        }
        // dimensioni finite

        // non siamo ne all'url ne abbiamo finito se il msg non è valido ritorno, altrimenti procedo

        if (
            !this.validMsg(message, this.minValue, this.maxValue) &&
            !this.ignoreMsg
        ) {
            let messageToSend = "";
            if (!this.showMagnitudeAnswer) {
                messageToSend = `Please type a integer number between ${this.minValue} and ${this.maxValue}`;
            } else {
                messageToSend = `Please type a integer number higher than ${this.minValue} `;
            }
            this.typingAnimation(messageToSend);
            return;
        } else {
            if (!this.ignoreMsg) {
                this.cleanUserInput();
                const subtaskIndex = this.subTaskIndex - 1;
                this.answers[this.taskIndex][subtaskIndex] = message;
                let dimSel = {};
                dimSel["document"] = this.taskIndex;
                dimSel["dimension"] = subtaskIndex;
                dimSel["index"] = this.indexDimSel[this.taskIndex];
                dimSel["timestamp"] = Date.now() / 1000;
                dimSel["value"] = message;
                this.dimsSelected.push(dimSel);
                this.indexDimSel[this.taskIndex] += 1;
                this.randomMessage();
            }
            await new Promise((resolve) => setTimeout(resolve, 3000));

            if (
                this.fixedMessage == null ||
                this.fixedMessage == undefined ||
                this.fixedMessage == ""
            ) {
                this.printStatement();
            }
            if (!!this.fixedMessage) {
                this.printDimension(this.subTaskIndex);
                this.selectDimensionToGenerate(this.subTaskIndex);
                this.subTaskIndex++;
            }
        }
        // Non eseguo controlli sul primo msg, ma sugli altri si
        this.ignoreMsg = false;
    }

    // Fase di review
    private async reviewP(message: string) {
        if (this.showInputDDL) {
            message = this.getDimensionAnswerValue(message);
            this.showInputDDL = false;
        }
        if (this.questionnaireReview) {
            if (this.pickReview) {
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
                        if (!this.validMsg(message, 1, 100)) {
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
                    this.currentQuestion = +message;
                    this.disableInput = true;
                    let previousQuestionIndex = this.currentQuestion - 1;
                    // mi calcolo il questionario di appartenenza e l'indice della domanda di riferimento
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
                        this.disableInput = false;
                        this.showInputDDL = true;
                        this.buttonsVisibility = null;
                        this.awaitingAnswer = true;
                        return;
                    } else if (
                        this.task.questionnaires[this.currentQuestionnaire]
                            .type == "crt" ||
                        this.task.questionnaires[this.currentQuestionnaire]
                            .type == "likert"
                    ) {
                        this.currentQuestion = previousQuestionIndex;
                        this.showMagnitudeAnswer = true;
                        this.showInputDDL = false;
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
                this.disableInput = false;
                this.typingAnimation("Let's review your answers!");
                this.typingAnimation(
                    this.createQuestionnaireRecap() +
                        "<br>Confirm your answers?"
                );
                this.reviewAnswersShown = true;
                this.showCMbuttons = true;
                return;
            }
            if (message.trim().toLowerCase() === "confirm") {
                this.showInputDDL = false;
                this.showCategoricalAnswers = false;
                this.showCMbuttons = false;
                this.questionnaireReview = false;

                // Passo al prossimo phase, resetto
                this.typingAnimation("Good, let's begin the real task!");
                this.taskStatus = EnConversationaTaskStatus.InstructionPhase;
                this.awaitingAnswer = false;
                this.disableInput = false;
                this.reviewAnswersShown = false;
                this.pickReview = false;
                this.sendQuestionnaireData();
                this.instructionP("0"); // TEST ROUND
                this.fixedMessage == null;
                return;
            } else if (message.trim().toLowerCase() === "modify") {
                this.showCMbuttons = false;
                this.buttonsVisibility = null;
                this.typingAnimation("Which one would you like to modify?");
                this.generateRevisionData();
                this.pickReview = true;
                return;
            } else {
                return;
            }
        }
        // Se stiamo modificando una dimensione
        if (this.pickReview) {
            if (this.dimensionReviewPrinted) {
                // Dimensione printata
                if (this.waitForUrl) {
                    if (!this.urlValid(message)) {
                        this.typingAnimation(
                            "Please type a valid url, try using the search bar on the right!"
                        );
                        return;
                    }
                    this.waitForUrl = false;
                    this.placeholderInput = "";
                    this.answersURL[this.taskIndex] = message;
                    //this.answers[this.taskIndex][this.subTaskIndex] = message;
                    // Resetto
                    this.reviewAnswersShown = false;
                    this.pickReview = false;
                } else {
                    if (this.showCategoricalAnswers) {
                        message = this.getCategoricalAnswerValue(message);
                    }

                    if (!this.validMsg(message, this.minValue, this.maxValue)) {
                        let messageToSend = "";
                        if (!this.showMagnitudeAnswer) {
                            messageToSend = `Please type a integer number between ${this.minValue} and ${this.maxValue}`;
                        } else {
                            messageToSend = `Please type a integer number higher than 0 `;
                        }
                        this.typingAnimation(messageToSend);
                        return;
                    }
                    let dimSel = {};
                    dimSel["document"] = this.taskIndex;
                    dimSel["dimension"] = this.subTaskIndex - 1;
                    dimSel["index"] = this.indexDimSel[this.taskIndex];
                    dimSel["timestamp"] = Date.now() / 1000;
                    dimSel["value"] = message;
                    this.dimsSelected.push(dimSel);
                    this.indexDimSel[this.taskIndex] += 1;
                    this.answers[this.taskIndex][this.subTaskIndex] = message; // Salvo i nuovi dati
                    // Resetto
                    this.reviewAnswersShown = false;
                    this.pickReview = false;
                }
            } else {
                if (!this.validMsg(message, 1, this.task.dimensionsAmount)) {
                    let messageToSend = `Please type a integer number between 1 and ${this.task.dimensionsAmount}`;
                    this.typingAnimation(messageToSend);
                    return;
                }
                // Salvo l'input e mostro la dimensione richiesta
                this.subTaskIndex = +message - 1;
                this.printDimension(this.subTaskIndex);
                this.selectDimensionToGenerate(this.subTaskIndex);
                this.dimensionReviewPrinted = true;
                return;
            }
        }
        // Ripeto questa fase finchè non ricevo un Confirm
        if (!this.reviewAnswersShown) {
            this.cleanUserInput();
            this.typingAnimation("Let's review your answers!");
            this.typingAnimation(
                this.createAnswerString() + "<br>Confirm your answers?"
            );
            this.showCMbuttons = true;
            this.reviewAnswersShown = true;
            return;
        }
        if (message.trim().toLowerCase() === "confirm") {
            this.showInputDDL = false;
            this.showCategoricalAnswers = false;
            this.showCMbuttons = false;
            document.getElementById(
                this.taskIndex.toString()
            ).style.backgroundColor = "#28A745";
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
                this.disableInput = false;
                this.showYNbuttons = true;
                this.taskStatus = EnConversationaTaskStatus.EndPhase;
                // INVIO DATI ALLA FINE DI OGNI CONFERMA DI UNO STATEMENT
                this.timestampsEnd[
                    this.currentQuestionnaire + this.taskIndex
                ].push(Date.now() / 1000);
                this.timestampsElapsed[
                    this.currentQuestionnaire + this.taskIndex
                ] +=
                    Number(
                        this.timestampsEnd[
                            this.currentQuestionnaire + this.taskIndex
                        ][
                            this.timestampsEnd[
                                this.currentQuestionnaire + this.taskIndex
                            ].length - 1
                        ]
                    ) -
                    Number(
                        this.timestampsStart[
                            this.currentQuestionnaire + this.taskIndex
                        ][
                            this.timestampsEnd[
                                this.currentQuestionnaire + this.taskIndex
                            ].length - 1
                        ]
                    );
                this.sendDataStatement();
                return;
            }
            this.timestampsEnd[this.currentQuestionnaire + this.taskIndex].push(
                Date.now() / 1000
            );
            this.timestampsElapsed[
                this.currentQuestionnaire + this.taskIndex
            ] +=
                Number(
                    this.timestampsEnd[
                        this.currentQuestionnaire + this.taskIndex
                    ][
                        this.timestampsEnd[
                            this.currentQuestionnaire + this.taskIndex
                        ].length - 1
                    ]
                ) -
                Number(
                    this.timestampsStart[
                        this.currentQuestionnaire + this.taskIndex
                    ][
                        this.timestampsEnd[
                            this.currentQuestionnaire + this.taskIndex
                        ].length - 1
                    ]
                );
            this.sendDataStatement(); // INVIO DATI ALLA FINE DI OGNI CONFERMA DI UNO STATEMENT
            // Passo al prossimo statement, resetto
            this.randomMessage();
            this.taskStatus = EnConversationaTaskStatus.TaskPhase;
            this.taskIndex += 1;
            this.reviewAnswersShown = false;
            this.ignoreMsg = true;
            this.subTaskIndex = 0;
            this.fixedMessage = null;
            this.taskP(message);
        } else if (message.trim().toLowerCase() === "modify") {
            this.showCMbuttons = false;
            this.typingAnimation("Which dimension would you like to change?");
            this.cleanUserInput();
            this.generateRevisionData();
            this.disableInput = false;
            this.pickReview = true; // Passo alla fase di modifica
            this.dimensionReviewPrinted = false; // Reset
            return;
        } else {
            return;
        }
    }

    private generateQuestionnaireAnswers() {
        this.mcqAnswersInfo = this.task.questionnaires[
            this.currentQuestionnaire
        ].questions[this.currentQuestion].answers.map((el) => ({
            label: el,
            value: el,
        }));
    }

    private generateRevisionData() {
        this.mcqAnswersInfo = [];
        //Revisione domande dei questionari
        if (this.questionnaireReview) {
            for (let i = 0; i < this.task.questionnaires.length; i++) {
                this.task.questionnaires[i].questions.forEach(
                    (question, index) => {
                        this.mcqAnswersInfo.push({
                            label: question.name,
                            value: (index + 1).toString(),
                        });
                    }
                );
            }
        } else {
            //Revisione dimensioni per ogni statement
            this.mcqAnswersInfo = this.task.dimensions.map(
                (dimension, index) => {
                    return {
                        label: dimension.name_pretty,
                        value: (index + 1).toString(),
                    };
                }
            );
        }

        this.showInputDDL = true;
    }
    private selectDimensionToGenerate(dimensionIndex) {
        let scaleType = null;
        if (!this.task.dimensions[dimensionIndex].scale) {
            scaleType = "url";
        } else {
            scaleType = this.task.dimensions[dimensionIndex].scale.type;
        }
        switch (scaleType) {
            case "url":
                this.waitForUrl = true;
                this.emitEnableSearchEngine();
                this.disableInput = true;
                this.typingAnimation(
                    "Please use the search bar on the right to search for information about the truthfulness of the statement. Once you find a suitable result, please type or select its url"
                );
                this.timestampsStart[
                    this.currentQuestionnaire + this.taskIndex
                ].push(Date.now() / 1000);

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

            default:
                console.warn("Casistica non gestita");
                break;
        }
        this.statementProvided = true;
    }

    private questionnaireP(message) {
        if (
            this.task.questionnaires[this.currentQuestionnaire].type ==
            "standard"
        ) {
            this.showMagnitudeAnswer = false;

            if (this.awaitingAnswer) {
                this.showInputDDL = false;
                this.disableInput = false;
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
                this.timestampsElapsed[this.currentQuestionnaire] =
                    Number(
                        this.timestampsEnd[this.currentQuestionnaire][
                            this.timestampsEnd[this.currentQuestionnaire]
                                .length - 1
                        ]
                    ) -
                    Number(
                        this.timestampsStart[this.currentQuestionnaire][
                            this.timestampsStart[this.currentQuestionnaire]
                                .length - 1
                        ]
                    );
                this.currentQuestionnaire += 1;
            } else {
                this.printQuestion();
                this.typingAnimation(this.createQuestionnaireAnswers());
                setTimeout(() => {
                    this.generateQuestionnaireAnswers();
                    this.showInputDDL = true;
                }, 850);

                this.disableInput = false;
                this.buttonsVisibility = null;
                this.awaitingAnswer = true;
                return;
            }
            if (this.checkIfQuestionnaireIsFinished()) return;
        }
        if (
            this.task.questionnaires[this.currentQuestionnaire].type == "crt" ||
            this.task.questionnaires[this.currentQuestionnaire].type == "likert"
        ) {
            this.showMagnitudeAnswer = true;
            this.showInputDDL = false;
            if (this.awaitingAnswer) {
                if (!this.validMsg(message, 1, 100)) {
                    this.typingAnimation(
                        "Please type a integer number between 1 and 100"
                    );
                    return;
                }

                this.questionnaireAnswers[this.currentQuestion] = message;
                this.currentQuestion += 1;
                this.randomMessage();
                this.timestampsEnd[this.currentQuestionnaire].push(
                    Date.now() / 1000
                );
                this.timestampsElapsed[this.currentQuestionnaire] =
                    Number(
                        this.timestampsEnd[this.currentQuestionnaire][
                            this.timestampsEnd[this.currentQuestionnaire]
                                .length - 1
                        ]
                    ) -
                    Number(
                        this.timestampsStart[this.currentQuestionnaire][
                            this.timestampsStart[this.currentQuestionnaire]
                                .length - 1
                        ]
                    );
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
            this.timestampsStart[this.currentQuestionnaire].push(
                Date.now() / 1000
            );
            this.awaitingAnswer = true;
        }
    }

    private checkIfQuestionnaireIsFinished() {
        let isFinished = false;
        if (this.currentQuestionnaire >= this.task.questionnaires.length) {
            isFinished = true;
            this.disableInput = true;
            this.taskStatus = EnConversationaTaskStatus.ReviewPhase;
            this.questionnaireReview = true;
        }
        return isFinished;
    }

    private emitResetSearchEngineState() {
        this.resetSearchEngine.emit();
    }

    private emitDisableSearchEngine() {
        this.disableSearchEngine.emit(true);
    }

    private emitEnableSearchEngine() {
        this.disableSearchEngine.next(false);
    }

    private skipQuestionnairePhase() {
        this.typingAnimation("Let's start, with the activity!");
        this.taskStatus = EnConversationaTaskStatus.TaskPhase;
        setTimeout(() => this.taskP("0"), 3000);
    }

    private async sendDataStatement() {
        // INVIO DATI ALLA FINE DI OGNI CONFERMA DI UNO STATEMENT
        let data = {};
        let actionInfo = {
            action: this.action, //Next se sto procedendo normalemnte, back se sto reviewando
            access: this.accessesAmount[this.taskIndex],
            try: this.task.tryCurrent,
            index: this.taskIndex, // dove siamo arrivati
            sequence: this.task.sequenceNumber,
            element: "document",
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo;
        /* Worker's answers for the current document */
        let answers = this.createAnswersPretty();
        this.answersPretty.push(answers);
        data["answers"] = answers;
        data["notes"] = [];
        /* Worker's dimensions selected values for the current document */
        let dimensionsSelectedValues = {};
        dimensionsSelectedValues["data"] = this.dimsSelected;
        dimensionsSelectedValues["amount"] =
            dimensionsSelectedValues["data"].length;
        data["dimensions_selected"] = dimensionsSelectedValues;
        let queries = {};
        queries["data"] = this.query;
        queries["amount"] = queries["data"].length;
        data["queries"] = queries;
        /* Start, end and elapsed timestamps for the current document */
        let timestampsStart =
            this.timestampsStart[this.currentQuestionnaire + this.taskIndex];
        data["timestamps_start"] = timestampsStart;
        let timestampsEnd =
            this.timestampsEnd[this.currentQuestionnaire + this.taskIndex];
        data["timestamps_end"] = timestampsEnd;
        data["timestamps_elapsed"] =
            this.timestampsElapsed[this.currentQuestionnaire + this.taskIndex];

        /* Countdown time and corresponding flag */
        data["countdowns_times_start"] = [];
        data["countdowns_times_left"] = [];
        data["countdowns_expired"] = [];
        /* Number of accesses to the current document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
        data["accesses"] = this.accessesAmount[this.taskIndex];
        let resRet = {};
        resRet["data"] = this.queryRetrieved;
        let n = 0;
        for (let i = 0; i < this.queryRetrieved.length; i++) {
            n += this.queryRetrieved[i]["response"].length;
        }
        resRet["amount"] = n;
        resRet["groups"] = resRet["data"].length;
        /* Responses retrieved by search engine for each worker's query for the current document */
        data["responses_retrieved"] = resRet;
        let resSel = {};
        resSel["data"] = this.querySelected;
        resSel["amount"] = resSel["data"].length;
        /* Responses by search engine ordered by worker's click for the current document */
        data["responses_selected"] = resSel;
        //if (this.sendData) await this.dynamoDBService.insertData(this.configService.environment,this.worker.identifier,this.task.unitId, this.tryNumber,this.task.sequenceNumber, data)
        this.task.sequenceNumber += 1;
        let elem = {};
        elem["data"] = this.dimsSelected;
        elem["amount"] = this.dimsSelected.length;
        if (this.dimsSelected.length >= 1) this.dimensionSelected.push(elem);

        let elem1 = {};
        elem1["data"] = this.query;
        elem1["amount"] = this.query.length;
        if (this.query.length >= 1) this.queryTotal.push(elem1);

        let elem2 = {};
        elem2["data"] = this.queryRetrieved;
        elem2["amount"] = this.queryRetrieved.length;
        if (this.queryRetrieved.length >= 1)
            this.responsesRetrievedTotal.push(elem2);

        let elem3 = {};
        elem3["data"] = this.querySelected;
        elem3["amount"] = this.querySelected.length;
        if (this.querySelected.length >= 1)
            this.responsesSelectedTotal.push(elem3);

        this.dimsSelected = [];
        this.query = [];
        this.queryRetrieved = [];
        this.querySelected = [];
    }

    private cleanUserInput() {
        this.showCategoricalAnswers = false;
        this.showIntervalAnswer = false;
        this.showMagnitudeAnswer = false;
        this.waitForUrl = false;
        this.emitDisableSearchEngine();
        this.emitResetSearchEngineState();
    }
}
