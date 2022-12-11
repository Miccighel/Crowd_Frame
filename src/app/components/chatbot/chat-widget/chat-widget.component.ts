import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
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
import { Subject } from "rxjs";
/* Models */
import { Task } from "../../../models/skeleton/task";

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
    @ViewChild("buttonsYN", { static: true }) buttonsYN!: ElementRef;
    @ViewChild("buttonsNum", { static: true }) buttonsNum!: ElementRef;
    @ViewChild("buttonsCM", { static: true }) buttonsCM!: ElementRef;
    @ViewChild("fixedMsg", { static: true }) fixedMsg!: ElementRef;
    @ViewChild("typing", { static: true }) typing!: ElementRef;
    @ViewChild("inputBox", { static: true }) inputBox!: ElementRef;

    resetSearchEngineStateSubject: Subject<void> = new Subject<void>();

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
    commentIndex: number;
    charLimit: number;
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
    instructionPhase: boolean; // True: ci troviamo nella fase iniziale di instruzioni
    ignoreMsg: boolean; // True: ignora i messaggi in input
    taskPhase: boolean; // True: siamo nella fase di task vera e propria
    endTaskPhase: boolean; // True: siamo nella fase finale
    statementProvided: boolean; // True: ho già mostrato all'utente lo statement durante questa fase
    reviewPhase: boolean; // True: ci troviamo nella fase di review
    reviewAnswersShown: boolean; // True: la review delle risposte è stata mostrata
    pickReview: boolean; // True: stiamo attendendo input per modificare una dimension
    dimensionReviewPrinted: boolean;
    statementJump: boolean; // True: siamo nella fase di salto degli statement
    waitForUrl: boolean; // True: stiamo attendendo un url
    awaitingAnswer: boolean;
    questionnairePhase: boolean;
    questionnaireReview: boolean;
    //commentPhase: boolean
    action: string;
    disableInput = true;
    queryIndex: number[];
    sendData = false;

    // Variables
    fixedMessage: string; // Messaggio sempre visibile in alto nel chatbot
    answers: any[]; // Memorizzo le risposte di un singolo statement
    answersURL: string[]; // Memorizzo gli url
    numberBtn: string[]; // Utilizzato per generare i bottoni numerici
    questionnaireAnswers: any[];
    queue: number;
    buttonsVisibility: number; //0: nulla, 1: YS, 2: CM, 3: Num
    placeholderInput: string;
    tryNumber: number; // Numero di tentativi per completare
    accessesAmount: number[]; //Numero di accessi agli elementi

    // Messaggi per l'utente
    instr = [
        "Hello! I'm Fakebot and I'll be helping you complete this task! You can find the <b>instructions</b> in the top left corner of this page, just press the button whenever you need. Nothing will break down, I promise!",
        "Would you like to play a test round?",
    ];
    endOfTaskMessage = [
        "Oh! That was it! Thank you for completing the task! Here's your token: ...",
    ];
    repeat = "Please type a integer number between -2 and 2";

    constructor(
        changeDetector: ChangeDetectorRef,
        configService: ConfigService,
        ngxService: NgxUiLoaderService,
        S3Service: S3Service,
        sectionService: SectionService,
        dynamoDBService: DynamoDBService
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
        this.accessesAmount = new Array(11).fill(0);
        this.indexDimSel = new Array(11).fill(0);
        this.queryIndex = new Array(11).fill(0);
        this.answersURL = new Array(11).fill("");
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
            for (let j = 0; j < this.task.dimensions.length; j++) {
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
        this.buttonsYN.nativeElement.style.display = "none";
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
        this.questionnaireReview = false;
        this.questionnairePhase = true;
        this.statementProvided = false;
        this.queue = 0;
        this.buttonsVisibility = 0;
        this.placeholderInput = "";
        this.tryNumber = 1;
        //this.commentPhase = false
        this.commentIndex = 3;
        this.charLimit = 500;
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

        this.questionnaireAnswers = new Array(
            this.getNumberOfQuestionnaireQuestions()
        ).fill("");
        if (this.questionnaireAnswers.length > 0)
            this.typingAnimation("First, a few questions about yourself!");
        else {
            this.questionnairePhase = false;
            this.taskPhase = true;
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

        setTimeout(
            () =>
                this.questionnaireAnswers.length > 0
                    ? this.questionnaireP("0")
                    : this.skipQuestionnairePhase(),
            5000
        );

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
        for (var i = 2; i <= number; i++) {
            foos.push(i.toString());
        }
        return foos;
    }

    // Utilizzo dei bottoni
    public buttonInput(message: string) {
        this.sendMessage({ message });
    }

    // Controllo che un messaggio abbia valori compresi tra min e max e che sia un numero
    private validMsg(msg, min, max) {
        if (isNaN(+msg) || +msg % 1 != 0 || +msg < min || +msg > max) {
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
        ).style.backgroundColor = "red";
        this.typingAnimation(
            "Statement: <b>" +
                this.task.hit.documents[this.taskIndex]["statement_text"] +
                "</b> - " +
                this.task.hit.documents[this.taskIndex]["speaker_name"] +
                " " +
                this.task.hit.documents[this.taskIndex]["statement_date"]
        );
        this.fixedMessage =
            "<b>Statement</b>: " +
            this.task.hit.documents[this.taskIndex]["statement_text"] +
            "<br>" +
            "<b>Speaker</b>: " +
            this.task.hit.documents[this.taskIndex]["speaker_name"] +
            "<br>" +
            "<b>Date</b>: " +
            this.task.hit.documents[this.taskIndex]["statement_date"];
    }

    // Stampa la dimensione corrente
    private printDimension() {
        let out = "";
        if (this.task.dimensions[this.subTaskIndex].name_pretty) {
            out =
                "Please rate the <b>" +
                this.task.dimensions[this.subTaskIndex].name_pretty +
                "</b> of the statement.<br><b>" +
                this.task.dimensions[this.subTaskIndex].name_pretty +
                "</b>: " +
                this.task.dimensions[this.subTaskIndex].description +
                "<br>Please type a integer number between -2 and 2.";
        } else {
            out =
                "Please rate the <b>" +
                this.task.dimensions[this.subTaskIndex].name +
                "</b> of the statement.<br><b>" +
                this.task.dimensions[this.subTaskIndex].name +
                "</b>: " +
                this.task.dimensions[this.subTaskIndex].description +
                "<br>Please type a integer number between -2 and 2.";
        }
        if (!!this.answers[this.taskIndex][this.subTaskIndex]) {
            out +=
                "<br>You previously answered <b>" +
                this.answers[this.taskIndex][this.subTaskIndex] +
                "</b>.";
        }
        this.typingAnimation(out);
    }

    // Creo la stringa con le risposte date allo statement attuale
    private createAnswerString() {
        let recap = "";
        for (let i = 0; i < this.task.dimensions.length; i++) {
            if (this.task.dimensions[i].name_pretty) {
                recap +=
                    i +
                    1 +
                    ". <b>" +
                    this.task.dimensions[i].name_pretty +
                    "</b>: " +
                    this.answers[this.taskIndex][i] +
                    " (" +
                    this.task.dimensions[i].scale["mapping"][
                        +this.answers[this.taskIndex][i] + 2
                    ].label +
                    ")<br><br>";
            } else if (this.task.dimensions[i].scale) {
                recap +=
                    i +
                    1 +
                    ". <b>" +
                    this.task.dimensions[i].name +
                    "</b>: " +
                    this.answers[this.taskIndex][i] +
                    " (" +
                    this.task.dimensions[i].scale["mapping"][
                        +this.answers[this.taskIndex][i] + 2
                    ].label +
                    ")<br><br>";
            } else {
                recap +=
                    i +
                    1 +
                    ". <b>" +
                    this.task.dimensions[i].name +
                    "</b>: " +
                    this.answers[this.taskIndex][i] +
                    "</br>";
            }
        }
        recap +=
            this.task.dimensions.length +
            1 +
            ".<b> URL</b>: " +
            this.answersURL[this.taskIndex] +
            "<br>";
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
                ", " +
                this.task.hit.documents[i]["statement_date"] +
                "<br><br>";
        }
        return statements;
    }

    private createAnswersPretty() {
        let ans = {};
        let addOn = "_value";
        ans["overall-truthfulness" + addOn] = this.answers[this.taskIndex][0];
        ans["overall-truthfulness_url"] = this.answersURL[this.taskIndex];
        for (let i = 1; i < this.task.dimensions.length; i++) {
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
                for (let i = 0; i < 7; i++) {
                    ans[this.task.questionnaires[0].questions[i].name + addOn] =
                        this.questionnaireAnswers[i] - 1;
                }
            } else {
                ans[this.task.questionnaires[y].questions[0].name] =
                    this.questionnaireAnswers[6 + y];
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
        for (let i = 0; i < this.questionnaireAnswers.length; i++) {
            if (i < 7) {
                recap +=
                    i +
                    1 +
                    ". Question: <b>" +
                    this.task.questionnaires[0].questions[i].text +
                    "</b><br>Answer:<b> " +
                    this.task.questionnaires[0].questions[i].answers[
                        this.questionnaireAnswers[i] - 1
                    ] +
                    "</b><br><br>";
            } else {
                recap +=
                    i +
                    1 +
                    ". Question: <b>" +
                    this.task.questionnaires[i - 6].questions[0].text +
                    "</b><br>Answer:<b> " +
                    this.questionnaireAnswers[i] +
                    "</b><br><br>";
            }
        }
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
            if (this.buttonsVisibility == 1) {
                this.buttonsYN.nativeElement.style.display = "inline-block";
            }
            if (this.buttonsVisibility == 2) {
                this.buttonsCM.nativeElement.style.display = "inline-block";
            }
            if (this.buttonsVisibility == 3) {
                this.buttonsNum.nativeElement.style.display = "inline-block";
            }
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
        if (message.trim() === "") {
            return;
        }
        // Mostro il messaggio in chat
        this.addMessageClient(this.client, message, "sent");
        if (this.ignoreMsg) {
            return;
        } // Se il messaggio è da ignorare, lo ignoro

        // COMMENTO FINALE
        // if (this.commentPhase){
        //     if (this.commentIndex==0 || this.charLimit<=0){
        //         this.commentPhase=false
        //         this.typingAnimation("Thank you for sharing your thoughts! See you next time!")
        //         return
        //     }
        //     this.commentIndex-=1
        //     this.charLimit-=message.length
        //     let data = {}
        //     let actionInfo = {
        //         try: this.task.tryCurrent,
        //         sequence: this.task.sequenceNumber,
        //         element: "comment"
        //     };
        //     this.commentForm.value = message
        //     data["info"] = actionInfo
        //     data["comment"] = this.commentForm.value
        //     //if (this.sendData) await this.dynamoDBService.insertData(this.configService.environment,this.worker.identifier,this.task.unitId, this.tryNumber,this.task.sequenceNumber,data)
        //     this.task.sequenceNumber+=1
        // }

        // END TASK PHASE
        if (this.endTaskPhase) {
            this.endP(message);
            return;
        }

        //QUESTIONNAIRE PHASE
        if (this.questionnairePhase) {
            this.questionnaireP(message);
        }

        //INSTRUCTION PHASE
        if (this.instructionPhase) {
            this.instructionP(message);
        }

        //TASK PHASE
        if (this.taskPhase) {
            this.taskP(message);
        }
        //REVIEW PHASE
        if (this.reviewPhase) {
            this.reviewP(message);
        }
    }

    // Fase di fine task
    private async endP(message) {
        if (this.statementJump) {
            this.taskIndex = +message - 1;
            this.printStatement();
            this.endTaskPhase = false;
            this.reviewPhase = true;
            this.reviewAnswersShown = false;
            this.buttonsNum.nativeElement.style.display = "none";
            this.buttonsVisibility = 0;
            this.reviewP(message);
            // print answers e avvia come la review
        } else {
            if (message.trim().toLowerCase() === "yes") {
                this.action = "Back";
                this.typingAnimation(
                    this.createStatementString() +
                        "Which statement would you like to jump to?"
                );
                this.buttonsYN.nativeElement.style.display = "none";
                this.buttonsVisibility = 0;
                this.numberBtn = this.generateArrayNum(
                    this.task.documents.length
                );
                //this.buttonsNum.nativeElement.style.display = "inline-block"
                this.buttonsVisibility = 3;
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
                    ah["overall-truthfulness_url"] =
                        this.answersURL[this.goldHigh];
                    let al = {};
                    al["overall-truthfulness_value"] =
                        this.answers[this.goldLow][0];
                    al["overall-truthfulness_url"] =
                        this.answersURL[this.goldLow];
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
                        this.endTaskPhase = false;
                        return;
                    }
                    this.tryNumber += 1;
                    this.endTaskPhase = false;
                    this.taskPhase = true;
                    // Reinizializzo
                    for (let i = 0; i < 11; i++) {
                        document.getElementById(
                            i.toString()
                        ).style.backgroundColor = "#3f51b5";
                    }
                    this.typing.nativeElement.style.display = "none";
                    this.buttonsYN.nativeElement.style.display = "none";
                    this.ignoreMsg = true;
                    this.subTaskIndex = 0;
                    this.taskIndex = 0;
                    this.dimensionReviewPrinted = false;
                    this.reviewAnswersShown = false;
                    this.pickReview = false;
                    this.statementJump = false;
                    this.waitForUrl = false;
                    this.awaitingAnswer = false;
                    this.statementProvided = false;
                    this.buttonsVisibility = 0;
                    this.taskP("0");
                    return;
                }
                this.buttonsYN.nativeElement.style.display = "none";
                this.buttonsVisibility = 0;
                this.typingAnimation(this.endOfTaskMessage[0]);
                this.typingAnimation("You may now close the page!");
                this.endTaskPhase = false;
                //this.commentPhase = true
            } else {
                return;
            }
        }
    }

    // Fase di istruzioni
    private instructionP(message: string) {
        /*
        let startMsg: string
        if (message.trim().toLowerCase() === "yes") {
            startMsg = "OK! Let's start!"
        }
        else if (message.trim().toLowerCase() === "no") {
            startMsg = "OK! Let's get to the real thing!"
            // Salta la prima subtask TODO
            //this.taskIndex += 1
        } else { return }
        this.typingAnimation(startMsg)
        this.buttonsYN.nativeElement.style.display = "none" // Non mostro più i messaggi y/n
        this.buttonsVisibility=0*/
        this.taskPhase = true; // Passiamo alla task phase
        this.instructionPhase = false; // Finita la instruction phase
        this.ignoreMsg = true;
        this.typingAnimation(
            "I'll now show you some statements and for each one I'll ask you some questions. Please use the search bar on the left to search for info about those statement and answer my questions"
        );
        this.taskP("p");
    }

    // Fase di task
    private taskP(message: string) {
        // Se sto chiedendo l'url
        if (this.waitForUrl) {
            if (!this.urlValid(message)) {
                this.typingAnimation(
                    "Please type or select a valid url, try using the search bar on the right!"
                );
                return;
            }
            this.waitForUrl = false;
            this.disableInput = false;
            this.answersURL[this.taskIndex] = message;
            this.placeholderInput = "";
            this.ignoreMsg = true;
        }
        // dimensioni finite
        if (
            this.task.dimensions.length <= this.subTaskIndex &&
            this.validMsg(message, -2, +2)
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
            this.taskPhase = false;
            this.reviewPhase = true;
            this.reviewAnswersShown = false;
            this.reviewP(message);
            return;
        }
        // non siamo ne all'url ne abbiamo finito se il msg non è valido ritorno, altrimenti procedo
        if (!this.validMsg(message, -2, +2) && !this.ignoreMsg) {
            this.typingAnimation(this.repeat);
            return;
        } else {
            if (!this.statementProvided) {
                this.printStatement();
                this.waitForUrl = true;
                this.disableInput = true;

                this.typingAnimation(
                    "Please use the search bar on the right to search for information about the truthfulness of the statement. Once you find a suitable result, please type or select its url"
                );
                this.timestampsStart[
                    this.currentQuestionnaire + this.taskIndex
                ].push(Date.now() / 1000);
                this.statementProvided = true;
                return;
            }
            if (!this.ignoreMsg) {
                this.answers[this.taskIndex][this.subTaskIndex - 1] = message;
                let dimSel = {};
                dimSel["document"] = this.taskIndex;
                dimSel["dimension"] = this.subTaskIndex - 1;
                dimSel["index"] = this.indexDimSel[this.taskIndex];
                dimSel["timestamp"] = Date.now() / 1000;
                dimSel["value"] = message;
                this.dimsSelected.push(dimSel);
                this.indexDimSel[this.taskIndex] += 1;
                this.randomMessage();
            }
            this.emitResetSearchEngineState();
            this.printDimension();
            this.subTaskIndex += 1;
        }
        // Non eseguo controlli sul primo msg, ma sugli altri si
        this.ignoreMsg = false;
    }

    // Fase di review
    private async reviewP(message: string) {
        if (this.questionnaireReview) {
            if (this.pickReview) {
                if (this.awaitingAnswer) {
                    if (this.currentQuestionnaire == 0) {
                        if (
                            !this.validMsg(
                                message,
                                1,
                                this.task.questionnaires[
                                    this.currentQuestionnaire
                                ].questions[this.currentQuestion].answers.length
                            )
                        ) {
                            this.typingAnimation(
                                "Please type a valid integer number"
                            );
                            return;
                        }
                    }
                    if (this.currentQuestionnaire >= 1) {
                        if (!this.validMsg(message, 1, 100)) {
                            this.typingAnimation(
                                "Please type a integer number between 1 and 100"
                            );
                            return;
                        }
                    }
                    this.questionnaireAnswers[this.currentQuestion] = message;
                    this.reviewAnswersShown = false;
                    this.buttonsNum.nativeElement.style.display = "none";
                    this.buttonsVisibility = 0;
                    this.pickReview = false;
                    this.awaitingAnswer = false;
                } else {
                    if (!this.validMsg(message, 1, 10)) {
                        this.typingAnimation(
                            "Please type a valid integer number"
                        );
                        return;
                    }
                    this.currentQuestion = +message - 1;
                    if (+message - 1 < 7) {
                        this.currentQuestionnaire = 0;
                        this.printQuestion();
                    } else {
                        this.currentQuestionnaire =
                            +message - this.questionnaireAnswers.length;
                        this.buttonsNum.nativeElement.style.display = "none";
                        this.buttonsVisibility = 0;
                        this.typingAnimation(
                            this.task.questionnaires[this.currentQuestionnaire]
                                .questions[0].text
                        );
                    }
                    if (this.currentQuestionnaire == 0) {
                        this.typingAnimation(this.createQuestionnaireAnswers());
                        this.numberBtn = this.generateArrayNum(
                            this.task.questionnaires[this.currentQuestionnaire]
                                .questions[this.currentQuestion].answers.length
                        );
                        //this.buttonsNum.nativeElement.style.display = "inline-block"
                        this.buttonsVisibility = 3;
                    }
                    this.awaitingAnswer = true;
                    this.buttonsCM.nativeElement.style.display = "none";
                    this.buttonsVisibility = 0;
                    return;
                }
            }
            if (!this.reviewAnswersShown) {
                this.typingAnimation("Let's review your answers!");
                this.typingAnimation(
                    this.createQuestionnaireRecap() +
                        "<br>Confirm your answers?"
                );
                this.reviewAnswersShown = true;
                //this.buttonsCM.nativeElement.style.display = "inline-block"
                this.buttonsVisibility = 2;
                return;
            }
            if (message.trim().toLowerCase() === "confirm") {
                this.buttonsCM.nativeElement.style.display = "none";
                this.buttonsVisibility = 0;
                // Passo al prossimo phase, resetto
                this.typingAnimation("Good, let's begin the real task!");
                // TEST ROUND this.typingAnimation(this.instr[1])
                this.instructionPhase = true;
                this.awaitingAnswer = false;
                this.questionnaireReview = false;
                this.reviewAnswersShown = false;
                this.buttonsNum.nativeElement.style.display = "none";
                this.buttonsVisibility = 0;
                // TEST ROUND this.buttonsVisibility=1
                this.pickReview = false;
                this.reviewPhase = false;
                this.sendQuestionnaireData();
                this.instructionP("0"); // TEST ROUND
                return;
            } else if (message.trim().toLowerCase() === "modify") {
                this.buttonsCM.nativeElement.style.display = "none";
                this.buttonsVisibility = 0;
                this.numberBtn = this.generateArrayNum(
                    this.task.documents.length
                );
                //this.buttonsNum.nativeElement.style.display = "inline-block"
                this.buttonsVisibility = 3;
                this.typingAnimation("Which one would you like to modify?");
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
                    // Resetto
                    this.reviewAnswersShown = false;
                    this.pickReview = false;
                } else {
                    if (!this.validMsg(message, -2, 2)) {
                        this.typingAnimation(this.repeat);
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
                if (!this.validMsg(message, 1, 10)) {
                    this.typingAnimation(
                        "Please type a integer number between 1 and 10"
                    );
                    return;
                }
                this.buttonsNum.nativeElement.style.display = "none";
                this.buttonsVisibility = 0;
                if (message.trim() == "10") {
                    this.waitForUrl = true;
                    this.typingAnimation("Sure, please enter the correct url");
                } else {
                    // Salvo l'input e mostro la dimensione richiesta
                    this.subTaskIndex = +message - 1;
                    this.printDimension();
                }
                this.dimensionReviewPrinted = true;
                return;
            }
        }
        // Ripeto questa fase finchè non ricevo un Confirm
        if (!this.reviewAnswersShown) {
            //this.buttonsCM.nativeElement.style.display = "inline-block"
            this.buttonsVisibility = 2;
            this.typingAnimation("Let's review your answers!");
            this.typingAnimation(
                this.createAnswerString() + "<br>Confirm your answers?"
            );
            this.reviewAnswersShown = true;
            return;
        }
        if (message.trim().toLowerCase() === "confirm") {
            this.buttonsCM.nativeElement.style.display = "none";
            this.buttonsVisibility = 0;
            document.getElementById(
                this.taskIndex.toString()
            ).style.backgroundColor = "green";
            // Se era l'ultimo statement, passo alla fase finale this.task.hit.documents.length
            if (
                this.task.hit.documents.length - 1 <= this.taskIndex ||
                this.statementJump
            ) {
                this.statementJump = false;
                this.taskPhase = false;
                this.endTaskPhase = true;
                this.reviewPhase = false;
                this.reviewAnswersShown = false;
                this.numberBtn = this.generateArrayNum(
                    this.task.documents.length
                );
                this.typingAnimation(
                    "OK! Would you like to jump to a specific statement?"
                );
                //this.buttonsYN.nativeElement.style.display = "inline-block"
                this.buttonsVisibility = 1;
                // Printa gli statement, new funzione
                this.taskPhase = false;
                this.endTaskPhase = true;
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
            this.reviewPhase = false;
            this.taskPhase = true;
            this.taskIndex += 1;
            this.reviewAnswersShown = false;
            this.ignoreMsg = true;
            this.subTaskIndex = 0;
            this.taskP(message);
        } else if (message.trim().toLowerCase() === "modify") {
            this.buttonsCM.nativeElement.style.display = "none";
            this.buttonsVisibility = 0;
            this.numberBtn = this.generateArrayNum(
                this.task.dimensions.length + 1
            );
            //this.buttonsNum.nativeElement.style.display = "inline-block"
            this.buttonsVisibility = 3;
            this.typingAnimation("Which dimension would you like to change?");
            this.pickReview = true; // Passo alla fase di modifica
            this.dimensionReviewPrinted = false; // Reset
            return;
        } else {
            return;
        }
    }

    private questionnaireP(message) {
        if (this.currentQuestionnaire == 0) {
            if (this.awaitingAnswer) {
                if (
                    !this.validMsg(
                        message,
                        1,
                        this.task.questionnaires[this.currentQuestionnaire]
                            .questions[this.currentQuestion].answers.length
                    )
                ) {
                    this.typingAnimation(
                        "Please type a integer number between 1 and " +
                            this.task.questionnaires[this.currentQuestionnaire]
                                .questions[this.currentQuestion].answers.length
                    );
                    return;
                }
                this.buttonsNum.nativeElement.style.display = "none";
                this.buttonsVisibility = 0;
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
                this.numberBtn = this.generateArrayNum(
                    this.task.questionnaires[this.currentQuestionnaire]
                        .questions[this.currentQuestion].answers.length
                );
                //this.buttonsNum.nativeElement.style.display = "inline-block"
                this.buttonsVisibility = 3;
                this.awaitingAnswer = true;
                return;
            }
            if (this.checkIfQuestionnaireIsFinished()) return;
        }
        if (this.currentQuestionnaire >= 1) {
            if (this.awaitingAnswer) {
                if (!this.validMsg(message, 1, 100)) {
                    this.typingAnimation(
                        "Please type a integer number between 1 and 100"
                    );
                    return;
                }
                this.buttonsNum.nativeElement.style.display = "none";
                this.buttonsVisibility = 0;
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
                this.task.questionnaires[this.currentQuestionnaire].questions[0]
                    .text
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
            this.questionnairePhase = false;
            this.reviewPhase = true;
            this.questionnaireReview = true;
        }
        return isFinished;
    }

    private emitResetSearchEngineState() {
        this.resetSearchEngineStateSubject.next();
    }

    private skipQuestionnairePhase() {
        this.typingAnimation("Let's start, with the activity!");
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
}
