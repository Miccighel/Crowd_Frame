import {Document} from "../../../../data/build/skeleton/document";
import {Instruction} from "./instructions";
import {Questionnaire} from "./questionnaires/questionnaire";
import {Dimension} from "./dimension";
import {Note} from "./annotators/notes";
import {NoteStandard} from "./annotators/notesStandard";
import {NoteLaws} from "./annotators/notesLaws";
import {TaskSettings} from "./taskSettings";
import {Object} from "aws-sdk/clients/customerprofiles";

export class Task {

    /* Task settings and parameters */
    public settings: TaskSettings
    public platformName: string
    public taskName: string
    public batchName: string
    public workerId: string
    public unitId: string
    public tokenInput: string
    public tokenOutput: string
    public tryCurrent: number
    public instructionsGeneralAmount: number
    public instructionsEvaluationAmount: number
    public questionnaireAmount: number
    public questionnaireAmountStart: number
    public questionnaireAmountEnd: number
    public documentsAmount: number
    public dimensionsAmount: number
    public sequenceNumber: number

    /* Array of documents */
    documents: Array<Document>;
    documentsPairwiseSelection: Array<Array<boolean>>;

    /* Array of task instructions. Each object represents a paragraph with an optional caption made of steps */
    instructionsGeneral: Array<Instruction>;

    /* Array of evaluation instructions. Each object represents a paragraph with an optional caption made of steps */
    instructionsEvaluation: Array<Instruction>;

    /* Reference to the current questionnaires */
    questionnaires: Array<Questionnaire>;

    /* Array of dimensions to be assessed */
    dimensions: Array<Dimension>;
    /* Selected values for each dimension. Used to reconstruct worker's behavior. */
    dimensionsSelectedValues: Array<object>;
    /* Reference to the current dimension */
    currentDimension: number;
    dimensionsPairwiseSelection = [];

    /* Array to store search engine queries and responses, one for each document within a Hit */
    searchEngineQueries: Array<object>;
    /* Reference to the current query */
    currentQuery: number
    /* Array to store the responses retrieved by the search engine */
    searchEngineRetrievedResponses: Array<object>;
    /* Array to store the responses selected by workers within search engine results */
    searchEngineSelectedResponses: Array<object>;

    /* Array of accesses counters, one for each element (questionnaire + documents) */
    elementsAccesses: Array<number>;

    /* Arrays to record timestamps, one for each document within a Hit */
    timestampsStart: Array<Array<number>>;
    timestampsEnd: Array<Array<number>>;
    timestampsElapsed: Array<number>;

    /* Optional countdown to use for each document */
    documentsCountdownTime: Array<number>
    /* Array of checks to see if the countdowns are expired; one for each document */
    countdownsExpired: Array<boolean>;

    /* Arrays to store user annotations, one for each document within a Hit */
    notes: Array<Array<Note>>
    notesDone: boolean[];
    /* Array of checks to understand if the annotation button should be disabled, one for each document */
    annotationsDisabled: Array<boolean>

    /* Array of gold documents within a Hit */
    goldDocuments: Array<Document>;
    /* Array of gold dimensions within a Hit */
    goldDimensions: Array<Dimension>;

    constructor() {
        this.tryCurrent = 1
        this.sequenceNumber = 0
    }

    public getElementIndex(stepIndex) {
        let elementType = ""
        let elementIndex = 0
        if (stepIndex >= this.questionnaireAmountStart && stepIndex < this.questionnaireAmountStart + this.documentsAmount) {
            elementType = "S"
            elementIndex = stepIndex - this.questionnaireAmountStart
        } else if (stepIndex < this.questionnaireAmountStart) {
            elementType = "Q"
            elementIndex = stepIndex
        } else if (stepIndex >= this.questionnaireAmountStart + this.documentsAmount && stepIndex < this.getElementsNumber() &&  this.questionnaireAmountEnd > 0) {
            elementType = "Q"
            elementIndex = stepIndex - this.documentsAmount
        } else if (stepIndex >= this.questionnaireAmountStart + this.documentsAmount && this.questionnaireAmountEnd == 0)  {
            elementType = "Outcome"
            elementIndex = null
        }  else if (stepIndex >= this.questionnaireAmountStart + this.documentsAmount && stepIndex >= this.getElementsNumber() && this.questionnaireAmountEnd > 0)  {
            elementType = "Outcome"
            elementIndex = null
        }
        return {
            "elementType": elementType,
            "elementIndex": elementIndex,
        }
    }

    public initializeDocuments(rawDocuments) {
        this.documents = new Array<Document>();
        /*  Each document of the current hit is parsed using the Document interface.  */
        for (let index = 0; index < rawDocuments.length; index++) {
            let currentDocument = rawDocuments[index];
            this.documents.push(new Document(index, currentDocument));
        }
        this.searchEngineQueries = new Array<object>(this.documentsAmount);
        for (let index = 0; index < this.searchEngineQueries.length; index++) {
            this.searchEngineQueries[index] = {};
            this.searchEngineQueries[index]["data"] = [];
            this.searchEngineQueries[index]["amount"] = 0;
        }
        this.currentQuery = 0;
        this.searchEngineRetrievedResponses = new Array<object>(this.documentsAmount);
        for (let index = 0; index < this.searchEngineRetrievedResponses.length; index++) {
            this.searchEngineRetrievedResponses[index] = {};
            this.searchEngineRetrievedResponses[index]["data"] = [];
            this.searchEngineRetrievedResponses[index]["amount"] = 0;
        }
        this.searchEngineSelectedResponses = new Array<object>(this.documentsAmount);
        for (let index = 0; index < this.searchEngineSelectedResponses.length; index++) {
            this.searchEngineSelectedResponses[index] = {};
            this.searchEngineSelectedResponses[index]["data"] = [];
            this.searchEngineSelectedResponses[index]["amount"] = 0;
        }

        this.notesDone = new Array<boolean>();
        this.annotationsDisabled = new Array<boolean>();
        if (this.settings.annotator) {
            switch (this.settings.annotator.type) {
                case "options":
                    this.notes = new Array<Array<NoteStandard>>(this.documentsAmount);
                    for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];
                    for (let index = 0; index < this.notes.length; index++) this.annotationsDisabled.push(true)
                    break;
                case "laws":
                    this.notes = new Array<Array<NoteLaws>>(this.documentsAmount);
                    this.notesDone = new Array<boolean>(this.documentsAmount);
                    for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];
                    for (let i = 0; i < this.notesDone.length; i++) this.notesDone[i] = false;
                    break
            }
        } else {
            this.notes = new Array<Array<NoteStandard>>(this.documentsAmount);
            for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];
            for (let index = 0; index < this.notes.length; index++) this.annotationsDisabled.push(true)
        }
        this.documentsCountdownTime = new Array<number>(this.documentsAmount);
        this.countdownsExpired = new Array<boolean>(this.documentsAmount);
        for (let index = 0; index < this.documents.length; index++) {
            this.documentsCountdownTime[index] = this.settings.countdown_time;
            if (this.settings.countdown_attribute_values[index]) {
                for (const attributeValue of Object.values(this.documents[index])) {
                    if (attributeValue == this.settings.countdown_attribute_values[index]['name']) {
                        this.documentsCountdownTime[index] = this.documentsCountdownTime[index] + this.settings.countdown_attribute_values[index]['time']
                    }
                }
            }
            if (this.settings.countdown_position_values[index])
                this.documentsCountdownTime[index] = this.documentsCountdownTime[index] + this.settings.countdown_position_values[index]['time']
            this.countdownsExpired[index] = false
        }
        for (let index = 0; index < this.documents.length; index++) {
            this.countdownsExpired[index] = false
        }
        this.documentsPairwiseSelection = new Array<Array<boolean>>(this.documentsAmount);
        for (let i = 0; i < this.documentsPairwiseSelection.length; i++) {
            let selection = []
            selection[0] = false
            selection[1] = false
            this.documentsPairwiseSelection[i] = selection
        }
        this.goldDocuments = new Array<Document>();
        /* Indexes of the gold elements are retrieved */
        for (let index = 0; index < this.documentsAmount; index++) {
            if ('id' in this.documents[index]) {
                if (this.documents[index]['id'].includes('GOLD')) {
                    this.goldDocuments.push(this.documents[index])
                }
            }
        }
    }

    public initializeInstructionsGeneral(rawGeneralInstructions) {
        this.instructionsGeneralAmount = rawGeneralInstructions.length;
        /* The instructions are parsed using the Instruction class */
        this.instructionsGeneral = new Array<Instruction>();
        for (let index = 0; index < this.instructionsGeneralAmount; index++) {
            this.instructionsGeneral.push(new Instruction(index, rawGeneralInstructions[index]));
        }
    }

    public initializeQuestionnaires(rawQuestionnaires) {
        /* The array of questionnaires is initialized */
        this.questionnaires = new Array<Questionnaire>();
        this.questionnaireAmount = rawQuestionnaires.length;
        this.questionnaireAmountStart = 0;
        this.questionnaireAmountEnd = 0;
        /* Each questionnaire is parsed using the Questionnaire class */
        for (let index = 0; index < this.questionnaireAmount; index++) {
            let questionnaire = new Questionnaire(index, rawQuestionnaires[index])
            this.questionnaires.push(questionnaire);
            if (questionnaire.position == "start" || questionnaire.position == null) this.questionnaireAmountStart = this.questionnaireAmountStart + 1
            if (questionnaire.position == "end") this.questionnaireAmountEnd = this.questionnaireAmountEnd + 1
        }
    }

    public initializeInstructionsEvaluation(rawEvaluationInstructions) {
        this.instructionsEvaluationAmount = rawEvaluationInstructions.length;
        /* The instructions are parsed using the Instruction class */
        this.instructionsEvaluation = new Array<Instruction>();
        for (let index = 0; index < this.instructionsEvaluationAmount; index++) {
            this.instructionsEvaluation.push(new Instruction(index, rawEvaluationInstructions[index]));
        }
    }

    public initializeDimensions(rawDimensions) {
        /* The array of dimensions is initialized */
        this.dimensions = new Array<Dimension>();
        this.dimensionsAmount = rawDimensions.length;
        /* Each dimension is parsed using the Dimension class */
        for (let index = 0; index < this.dimensionsAmount; index++) this.dimensions.push(new Dimension(index, rawDimensions[index]));
        this.dimensionsSelectedValues = new Array<object>(this.documentsAmount);
        for (let index = 0; index < this.dimensionsSelectedValues.length; index++) {
            this.dimensionsSelectedValues[index] = {};
            this.dimensionsSelectedValues[index]["data"] = [];
            this.dimensionsSelectedValues[index]["amount"] = 0;
        }
        /* @Cristian Abbondo */
        /* Definizione array tridimensionale selezione elementi */
        for (let i = 0; i < this.documentsAmount; i++) {
            this.dimensionsPairwiseSelection[i] = []
            for (let j = 0; j < this.dimensionsAmount; j++) {
                this.dimensionsPairwiseSelection[i][j] = []
                this.dimensionsPairwiseSelection[i][j][0] = false
                this.dimensionsPairwiseSelection[i][j][1] = false
            }
        }
        this.goldDimensions = new Array<Dimension>();
        /* Indexes of the gold dimensions are retrieved */
        for (let index = 0; index < this.dimensionsAmount; index++) {
            if (this.dimensions[index].gold) {
                this.goldDimensions.push(this.dimensions[index])
            }
        }
    }

    /* This function is used to sort each dimension that a worker have to assess according the position specified */
    public filterDimensions(kind: string, position: string) {
        let filteredDimensions = []
        for (let dimension of this.dimensions) {
            if (dimension.style) {
                if (dimension.style.type == kind && dimension.style.position == position) filteredDimensions.push(dimension)
            }
        }
        return filteredDimensions
    }

    public getElementsNumber() {
        return this.questionnaireAmountStart + this.documentsAmount + this.questionnaireAmountEnd
    }

    public loadAccessCounter() {
        /* The array of accesses counter is initialized */
        let elementsAmount = this.getElementsNumber()
        this.elementsAccesses = new Array<number>(elementsAmount);
        for (let index = 0; index < this.elementsAccesses.length; index++) this.elementsAccesses[index] = 0;
    }

    public loadTimestamps() {
        /* Arrays of start, end and elapsed timestamps are initialized to track how much time the worker spends
             * on each document, including each questionnaire */
        this.timestampsStart = new Array<Array<number>>(this.getElementsNumber());
        this.timestampsEnd = new Array<Array<number>>(this.getElementsNumber());
        this.timestampsElapsed = new Array<number>(this.getElementsNumber());
        for (let i = 0; i < this.timestampsStart.length; i++) this.timestampsStart[i] = [];
        for (let i = 0; i < this.timestampsEnd.length; i++) this.timestampsEnd[i] = [];
        /* The task is now started and the worker is looking at the first questionnaire, so the first start timestamp is saved */
        this.timestampsStart[0].push(Math.round(Date.now() / 1000));
    }

    /*
     * This function intercepts a <changeEvent> triggered by the value controls of a dimension.
     * The parameters are:
     * - a JSON object which holds the selected selected value.
     * - a reference to the current document
     * - a reference to the current dimension
     * This array CAN BE EMPTY, if the worker does not select any value and leaves the task or if a dimension does not require a value.
     * These information are parsed and stored in the corresponding data structure.
     */
    public storeDimensionValue(valueData: Object, document: number, dimension: number) {
        /* The current document, dimension and user query are copied from parameters */
        let currentDocument = document
        let currentDimension = dimension
        /* A reference to the current dimension is saved */
        this.currentDimension = currentDimension;
        let currentValue = valueData['value'];
        let timeInSeconds = Date.now() / 1000;
        /* If some data for the current document already exists*/
        if (this.dimensionsSelectedValues[currentDocument]['amount'] > 0) {
            /* The new query is pushed into current document data array along with a document_index used to identify such query*/
            let selectedValues = Object.values(this.dimensionsSelectedValues[currentDocument]['data']);
            selectedValues.push({
                "document": currentDocument,
                "dimension": currentDimension,
                "index": selectedValues.length,
                "timestamp": timeInSeconds,
                "value": currentValue
            });
            /* The data array within the data structure is updated */
            this.dimensionsSelectedValues[currentDocument]['data'] = selectedValues;
            /* The total amount of selected values for the current document is updated */
            this.dimensionsSelectedValues[currentDocument]['amount'] = selectedValues.length;
        } else {
            /* The data slot for the current document is created */
            this.dimensionsSelectedValues[currentDocument] = {};
            /* A new data array for the current document is created and the fist selected value is pushed */
            this.dimensionsSelectedValues[currentDocument]['data'] = [{
                "document": currentDocument,
                "dimension": currentDimension,
                "index": 0,
                "timestamp": timeInSeconds,
                "value": currentValue
            }];
            /* The total amount of selected values for the current document is set to 1 */
            /* IMPORTANT: the document_index of the last selected value for a document will be <amount -1> */
            this.dimensionsSelectedValues[currentDocument]['amount'] = 1
        }
    }

    /*
     * This function intercepts a <queryEmitter> triggered by an instance of the search engine.
     * The parameter is a JSON object which holds the query typed by the worker within a given document.
     * These information are parsed and stored in the corresponding data structure.
     */
    public storeSearchEngineUserQuery(queryData: string, document: Document, dimension: Dimension) {
        this.currentDimension = dimension.index
        let currentQueryText = queryData;
        let timeInSeconds = Date.now() / 1000;
        /* If some data for the current document already exists*/
        if (this.searchEngineQueries[document.index]['amount'] > 0) {
            /* The new query is pushed into current document data array along with a document_index used to identify such query*/
            let storedQueries = Object.values(this.searchEngineQueries[document.index]['data']);
            storedQueries.push({
                "document": document.index,
                "dimension": dimension.index,
                "index": storedQueries.length,
                "timestamp": timeInSeconds,
                "text": currentQueryText
            });
            this.currentQuery = storedQueries.length - 1
            /* The data array within the data structure is updated */
            this.searchEngineQueries[document.index]['data'] = storedQueries;
            /* The total amount of query for the current document is updated */
            this.searchEngineQueries[document.index]['amount'] = storedQueries.length;
        } else {
            /* The data slot for the current document is created */
            this.searchEngineQueries[document.index] = {};
            /* A new data array for the current document is created and the fist query is pushed */
            this.searchEngineQueries[document.index]['data'] = [{
                "document": document.index,
                "dimension": dimension.index,
                "index": 0,
                "timestamp": timeInSeconds,
                "text": currentQueryText
            }];
            this.currentQuery = 0
            /* The total amount of query for the current document is set to 1 */
            /* IMPORTANT: the document_index of the last query inserted for a document will be <amount -1> */
            this.searchEngineQueries[document.index]['amount'] = 1
        }
    }

    /*
     * This function intercepts a <resultEmitter> triggered by an instance of the search engine.
     * The parameter is a JSON object which holds an array of <BaseResponse> objects, one for each search result.
     * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
     * These information are parsed and stored in the corresponding data structure.
     */
    public storeSearchEngineRetrievedResponse(retrievedResponseData: Object, document: Document, dimension: Dimension) {
        let currentRetrievedResponse = retrievedResponseData;
        let timeInSeconds = Date.now() / 1000;
        /* If some responses for the current document already exists*/
        if (this.searchEngineRetrievedResponses[document.index]['groups'] > 0) {
            /* The new response is pushed into current document data array along with its query document_index */
            let storedResponses = Object.values(this.searchEngineRetrievedResponses[document.index]['data']);
            storedResponses.push({
                "document": document.index,
                "dimension": dimension.index,
                "query": this.searchEngineQueries[document.index]['amount'] - 1,
                "index": storedResponses.length,
                "timestamp": timeInSeconds,
                "response": currentRetrievedResponse,
            });
            /* The data array within the data structure is updated */
            this.searchEngineRetrievedResponses[document.index]['data'] = storedResponses;
            /* The total amount retrieved responses for the current document is updated */
            this.searchEngineRetrievedResponses[document.index]['amount'] = this.searchEngineRetrievedResponses[document.index]['amount'] + currentRetrievedResponse.length
            /* The total amount of groups of retrieved responses for the current document is updated */
            this.searchEngineRetrievedResponses[document.index]['groups'] = storedResponses.length;
        } else {
            /* The data slot for the current document is created */
            this.searchEngineRetrievedResponses[document.index] = {};
            /* A new data array for the current document is created and the fist response is pushed */
            this.searchEngineRetrievedResponses[document.index]['data'] = [{
                "document": document.index,
                "dimension": dimension.index,
                "query": this.searchEngineQueries[document.index]['amount'] - 1,
                "index": 0,
                "timestamp": timeInSeconds,
                "response": currentRetrievedResponse
            }];
            /* The total amount of retrieved responses for the current document is set to the length of the first group */
            /* IMPORTANT: the document_index of the last retrieved response for a document will be <amount -1> */
            this.searchEngineRetrievedResponses[document.index]['amount'] = currentRetrievedResponse.length
            /* The total amount of groups retrieved responses for the current document is set to 1 */
            this.searchEngineRetrievedResponses[document.index]['groups'] = 1
        }
    }

    /*
     * This function intercepts a <selectedRowEmitter> triggered by an instance of the search engine.
     * The parameter is a JSON object which holds the selected search engine result within a given document.
     * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
     * These information are parsed and stored in the corresponding data structure.
     */
    public storeSearchEngineSelectedResponse(selectedResponseData: Object, document: Document, dimension: Dimension) {
        let currentSelectedResponse = selectedResponseData;
        let timeInSeconds = Date.now() / 1000;
        /* If some responses for the current document already exists*/
        if (this.searchEngineSelectedResponses[document.index]['amount'] > 0) {
            /* The new response is pushed into current document data array along with its query document_index */
            let storedResponses = Object.values(this.searchEngineSelectedResponses[document.index]['data']);
            storedResponses.push({
                "document": document.index,
                "dimension": dimension.index,
                "query": this.searchEngineQueries[document.index]['amount'] - 1,
                "index": storedResponses.length,
                "timestamp": timeInSeconds,
                "response": currentSelectedResponse,
            });
            /* The data array within the data structure is updated */
            this.searchEngineSelectedResponses[document.index]['data'] = storedResponses;
            /* The total amount of selected responses for the current document is updated */
            this.searchEngineSelectedResponses[document.index]['amount'] = storedResponses.length;
        } else {
            /* The data slot for the current document is created */
            this.searchEngineSelectedResponses[document.index] = {};
            /* A new data array for the current document is created and the fist response is pushed */
            this.searchEngineSelectedResponses[document.index]['data'] = [{
                "document": document.index,
                "dimension": dimension.index,
                "query": this.searchEngineQueries[document.index]['amount'] - 1,
                "index": 0,
                "timestamp": timeInSeconds,
                "response": currentSelectedResponse
            }];
            /* The total amount of selected responses for the current document is set to 1 */
            /* IMPORTANT: the document_index of the last selected response for a document will be <amount -1> */
            this.searchEngineSelectedResponses[document.index]['amount'] = 1
        }
    }

    /*
     * This function checks if each undeleted note of a document has a corresponding
     * option; if this is true the worker can proceed to the following element
     */
    public checkAnnotationConsistency(documentIndex: number) {
        let requiredAttributes = []
        for (let attribute of this.settings.attributes) {
            if (attribute.required) {
                requiredAttributes.push(attribute.index)
            }
        }
        let check = false
        this.notes[documentIndex].forEach((element) => {
            if (element instanceof NoteStandard) {
                if (!element.deleted && element.option != "not_selected") {
                    const index = requiredAttributes.indexOf(element.attribute_index);
                    if (index > -1) {
                        requiredAttributes.splice(index, 1);
                    }
                    check = true
                }
            } else {
                if (!element.deleted) check = true
            }
        })
        if (requiredAttributes.length > 0) {
            check = false
        }
        if (!this.settings.annotator) {
            check = true
        }
        return check
    }

    public checkAtLeastOneDocumentSelected(documentIndex: number) {
        let atLeastOneDocument = false
        for (let selection of this.documentsPairwiseSelection[documentIndex]) {
            if (selection)
                atLeastOneDocument = true
        }
        return atLeastOneDocument
    }

    /*
     * This function checks the presence of undeleted worker's notes. If there it as least one undeleted note, the summary table is shown
     */
    public checkUndeletedNotesPresence(notes) {
        let undeletedNotes = false
        for (let note of notes) {
            if (note.deleted == false && note.option != "not_selected") {
                undeletedNotes = true
                break
            }
        }
        return undeletedNotes
    }

    public buildTaskInitialPayload(worker) {
        let data = {}
        let actionInfo = {
            try: this.tryCurrent,
            sequence: this.sequenceNumber,
            element: "data"
        };
        /* The full information about task setup (currentDocument.e., its document and questionnaire structures) are uploaded, only once */
        let taskData = {
            platform_name: this.platformName,
            task_id: this.taskName,
            batch_name: this.batchName,
            worker_id: this.workerId,
            unit_id: this.unitId,
            token_input: this.tokenInput,
            token_output: this.tokenOutput,
            tries_amount: this.settings.allowed_tries,
            questionnaire_amount: this.questionnaireAmount,
            questionnaire_amount_start: this.questionnaireAmountStart,
            questionnaire_amount_end: this.questionnaireAmountEnd,
            documents_amount: this.documentsAmount,
            dimensions_amount: this.dimensionsAmount,
            settings: this.settings
        };
        data["info"] = actionInfo
        /* General info about task */
        data["task"] = taskData
        /* The answers of the current worker to the questionnaire */
        let questionnaires = []
        for (let questionnaire of this.questionnaires) {
            questionnaires.push(questionnaire.serializable())
        }
        data["questionnaires"] = questionnaires
        /* The parsed document contained in current worker's hit */
        data["documents"] = this.documents
        /* The dimensions of the answers of each worker */
        data["dimensions"] = this.dimensions
        /* General info about worker */
        data["worker"] = worker
        return data
    }

    public buildTaskQuestionnairePayload(questionnaireIndex, answers, action) {
        /* If the worker has completed the first questionnaire
         * The partial data about the completed questionnaire are uploaded */
        let data = {}

        let actionInfo = {
            action: action,
            access: this.elementsAccesses[questionnaireIndex],
            try: this.tryCurrent,
            index: questionnaireIndex,
            sequence: this.sequenceNumber,
            element: "questionnaire"
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo
        /* Worker's answers to the current questionnaire */
        data["answers"] = answers
        /* Start, end and elapsed timestamps for the current questionnaire */
        let timestampsStart = this.timestampsStart[questionnaireIndex];
        data["timestamps_start"] = timestampsStart
        let timestampsEnd = this.timestampsEnd[questionnaireIndex];
        data["timestamps_end"] = timestampsEnd
        let timestampsElapsed = this.timestampsElapsed[questionnaireIndex];
        data["timestamps_elapsed"] = timestampsElapsed
        /* Number of accesses to the current questionnaire (which must be always 1, since the worker cannot go back */
        data["accesses"] = this.elementsAccesses[questionnaireIndex]
        return data
    }

    public buildTaskDocumentPayload(documentIndex, answers, countdown, action) {
        /* If the worker has completed the first questionnaire
         * The partial data about the completed questionnaire are uploaded */
        let data = {}

        let actionInfo = {
            action: action,
            access: this.elementsAccesses[documentIndex],
            try: this.tryCurrent,
            index: documentIndex,
            sequence: this.sequenceNumber,
            element: "document"
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo
        /* Worker's answers for the current document */
        data["answers"] = answers
        let notes = (this.settings.annotator) ? this.notes[documentIndex] : []
        data["notes"] = notes
        /* Worker's dimensions selected values for the current document */
        let dimensionsSelectedValues = this.dimensionsSelectedValues[documentIndex];
        data["dimensions_selected"] = dimensionsSelectedValues
        /* Worker's search engine queries for the current document */
        let searchEngineQueries = this.searchEngineQueries[documentIndex];
        data["queries"] = searchEngineQueries
        /* Start, end and elapsed timestamps for the current document */
        let timestampsStart = this.timestampsStart[documentIndex];
        data["timestamps_start"] = timestampsStart
        let timestampsEnd = this.timestampsEnd[documentIndex];
        data["timestamps_end"] = timestampsEnd
        let timestampsElapsed = this.timestampsElapsed[documentIndex];
        data["timestamps_elapsed"] = timestampsElapsed
        /* Countdown time and corresponding flag */
        let countdownTimeStart = (this.settings.countdown_time >= 0) ? this.documentsCountdownTime[documentIndex] : []
        data["countdowns_times_start"] = countdownTimeStart
        let countdownTime = (this.settings.countdown_time >= 0) ? countdown : []
        data["countdowns_times_left"] = countdownTime
        let countdown_expired = (this.settings.countdown_time >= 0) ? this.countdownsExpired[documentIndex] : []
        data["countdowns_expired"] = countdown_expired
        /* Number of accesses to the current document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
        data["accesses"] = this.elementsAccesses[documentIndex];
        /* Responses retrieved by search engine for each worker's query for the current document */
        let responsesRetrieved = this.searchEngineRetrievedResponses[documentIndex];
        data["responses_retrieved"] = responsesRetrieved
        /* Responses by search engine ordered by worker's click for the current document */
        let responsesSelected = this.searchEngineSelectedResponses[documentIndex];
        data["responses_selected"] = responsesSelected
        return data
    }

    public buildTaskFinalPayload(questionnairesForms, documentsForms, qualityChecks, countdowns, action) {
        /* All data about documents are uploaded, only once */
        let actionInfo = {
            action: action,
            try: this.tryCurrent,
            element: "all"
        };
        let data = {}
        /* Info about each performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo
        let answers = [];
        for (let index = 0; index < questionnairesForms.length; index++) answers.push(questionnairesForms[index].value);
        data["questionnaires_answers"] = answers
        answers = [];
        for (let index = 0; index < documentsForms.length; index++) answers.push(documentsForms[index].value);
        data["documents_answers"] = answers
        let notes = (this.settings.annotator) ? this.notes : []
        data["notes"] = notes
        /* Worker's dimensions selected values for the current document */
        data["dimensions_selected"] = this.dimensionsSelectedValues
        /* Start, end and elapsed timestamps for each document */
        data["timestamps_start"] = this.timestampsStart
        data["timestamps_end"] = this.timestampsEnd
        data["timestamps_elapsed"] = this.timestampsElapsed
        /* Countdown time and corresponding flag for each document */
        let countdownTimes = [];
        let countdownTimesStart = [];
        let countdownExpired = [];
        if (this.settings.countdown_time >= 0)
            for (let countdown of countdowns) countdownTimes.push(countdown["i"]);
        if (this.settings.countdown_time >= 0)
            for (let countdown of this.documentsCountdownTime) countdownTimesStart.push(countdown);
        for (let index = 0; index < this.countdownsExpired.length; index++) countdownExpired.push(this.countdownsExpired[index]);
        data["countdowns_times_start"] = countdownTimesStart
        data["countdowns_times_left"] = countdownTimes
        data["countdowns_expired"] = countdownExpired
        /* Number of accesses to each document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
        data["accesses"] = this.elementsAccesses
        /* Worker's search engine queries for each document */
        data["queries"] = this.searchEngineQueries
        /* Responses retrieved by search engine for each worker's query for each document */
        data["responses_retrieved"] = this.searchEngineRetrievedResponses
        /* Responses by search engine ordered by worker's click for the current document */
        data["responses_selected"] = this.searchEngineSelectedResponses
        /* If the last element is a document */
        data["checks"] = qualityChecks
        actionInfo["sequence"] = this.sequenceNumber
        return data
    }

    public buildQualityChecksPayload(qualityChecks, action) {
        let checks = {}
        checks['info'] = {
            try: this.tryCurrent,
            sequence: this.sequenceNumber,
            element: "checks",
            action: action
        };
        checks['checks'] = qualityChecks
        return checks
    }
}
