import {Document} from "../../../data/build/skeleton/document";
import {Instruction} from "./instructions";
import {Questionnaire} from "./questionnaire";
import {Dimension} from "./dimension";
import {Note} from "./annotators/notes";
import {NoteStandard} from "./annotators/notes_standard";
import {NoteLaws} from "./annotators/notes_laws";
import {SettingsTask} from "./settingsTask";
import {Object} from "aws-sdk/clients/customerprofiles";

export class Task {

    public settings: SettingsTask

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
        if (this.settings.annotator) {
            switch (this.settings.annotator.type) {
                case "options":
                    this.notes = new Array<Array<NoteStandard>>(this.documentsAmount);
                    for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];
                    break;
                case "laws":
                    this.notes = new Array<Array<NoteLaws>>(this.documentsAmount);
                    for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];
            }
            this.annotationsDisabled = new Array<boolean>();
            for (let index = 0; index < this.documentsAmount; index++) {
                this.annotationsDisabled.push(true)
            }
            this.notesDone = [false, false, false, false, false]
        }
        if (this.settings.countdown_time >= 0) {
            this.documentsCountdownTime = new Array<number>(this.documentsAmount);
            for (let index = 0; index < this.documents.length; index++) {
                let position = this.settings.countdown_modality == 'position' ? this.documents[index]['index'] : null;
                let attribute = this.settings.countdown_modality == 'attribute' ? this.documents[index][this.settings.countdown_attribute] : null;
                this.documentsCountdownTime[index] = this.updateCountdownTime(position, attribute)
                this.countdownsExpired[index] = false
            }
        }
        this.countdownsExpired = new Array<boolean>(this.documentsAmount);
        for (let index = 0; index < this.documents.length; index++) {
            this.countdownsExpired[index] = false
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
        this.goldDimensions = new Array<Dimension>();
        /* Indexes of the gold dimensions are retrieved */
        for (let index = 0; index < this.dimensionsAmount; index++) {
            if (this.dimensions[index].gold) {
                this.goldDimensions.push(this.dimensions[index])
            }
        }
    }

    public getElementsNumber() {
        return this.questionnaireAmountStart + this.questionnaireAmount + this.questionnaireAmountEnd
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

    public updateCountdownTime(position: number = null, attribute: string = null) {
        let finalTime = this.settings.countdown_time
        if (position) {
            for (let positionData of this.settings.countdown_position_values) {
                if (positionData['position'] == position) {
                    finalTime = finalTime + positionData['time']
                }
            }
        }
        if (attribute) {
            for (let attributeData of this.settings.countdown_attribute_values) {
                if (attributeData['name'] == attribute)
                    finalTime = finalTime + attributeData['time']
            }
        }
        return finalTime;
    }

}
