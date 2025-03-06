/* Settings */
import {TaskSettings} from "./taskSettings";
/* Models */
import {Hit} from "./hit";
import {DataRecord} from "./dataRecord";
import {BaseInstruction} from "./instructions/baseInstruction";
import {EvaluationInstruction} from "./instructions/evaluationInstruction";
import {Document} from "../../../../data/build/skeleton/document";
import {Questionnaire} from "./questionnaires/questionnaire";
import {Dimension, ScaleInterval, ScaleMagnitude} from "./dimension";
/* Annotator */
import {Note} from "./annotators/notes";
import {NoteStandard} from "./annotators/notesStandard";
import {NoteLaws} from "./annotators/notesLaws";
/* Search Engine */
import {PreRetrievedResultsSettings, SearchEngineSettings} from "../searchEngine/searchEngineSettings";
import {PreRetrievedResult} from "../searchEngine/preRetrievedResult";
/* Worker */
import {Worker} from "../worker/worker";

export class Task {

    /* Task settings and parameters */
    public settings: TaskSettings;
    public platformName: string;
    public taskName: string;
    public batchName: string;
    public workerId: string;
    public unitId: string;
    public hit: Hit;
    public tokenInput: string;
    public tokenOutput: string;
    public tryCurrent: number;
    public instructionsGeneralAmount: number;
    public instructionsEvaluationGeneralAmount: number;
    public questionnaireAmount: number;
    public questionnaireAmountStart: number;
    public questionnaireAmountEnd: number;
    public documentsAmount: number;
    public dimensionsAmount: number;
    public sequenceNumber: number;
    public searchEngineSettings: SearchEngineSettings;

    /* Array of data records uploaded during a previous session */
    dataRecords: Array<DataRecord>
    /* Most recent data record for each document */
    mostRecentDataRecordsForDocuments: Array<DataRecord>
    /* Most recent data record for each questionnaire */
    mostRecentDataRecordsForQuestionnaires: Array<DataRecord>

    /* Array of documents */
    documents: Array<Document>;
    documentsPairwiseSelection: Array<Array<boolean>>;

    /* Array of task instructions. Each object represents a paragraph with an optional caption made of steps */
    instructionsGeneral: Array<BaseInstruction>;

    /* Array of evaluation instructions. Each object represents a paragraph with an optional caption made of steps */
    instructionsEvaluation: EvaluationInstruction;

    /* Reference to the current questionnaires */
    questionnaires: Array<Questionnaire>;

    /* Reference to the current dimension */
    currentDimension: number;
    /* Array of dimensions to be assessed */
    dimensions: Array<Dimension>;
    /* Selected values for each dimension. Used to reconstruct worker's behavior. */
    dimensionsSelectedValues: Array<object>;
    dimensionsPairwiseSelection = [];
    /* Array of intervall minimum and maximum values for each document */
    dimensionIntervalMinValues: Array<number>;
    dimensionIntervalMaxValues: Array<number>;

    /* Array to store search engine queries and responses, one for each document within a Hit */
    searchEngineQueries: Array<object>;
    /* Reference to the current query */
    currentQuery: number;
    /* Array to store the responses retrieved by the search engine */
    searchEngineRetrievedResponses: Array<object>;
    /* Array to store the responses selected by workers within search engine results */
    searchEngineSelectedResponses: Array<object>;
    searchEnginePreRetrievedResults: Array<Array<PreRetrievedResult>>;
    searchEnginePreRetrievedResultsSettings: PreRetrievedResultsSettings;

    /* Array of accesses counters, one for each element (questionnaire + documents) */
    elementsAccesses: Array<number>;

    /* Arrays to record timestamps, one for each document within a Hit */
    timestampsStart: Array<Array<number>>;
    timestampsEnd: Array<Array<number>>;
    timestampsElapsed: Array<number>;

    /* Optional countdown to use for each document */
    documentsCountdownTime: Array<number>;
    documentsStartCountdownTime: Array<number>;
    /* Array of checks to see if the countdowns are expired; one for each document */
    countdownsExpired: Array<boolean>;
    /* Array of checks to see if the countdowns were started, one per document; kind of redundant but makes things easier */
    countdownsStarted: Array<boolean>;
    /* Array to record when the countdown expires using a timestamp */
    countdownExpiredTimestamp: Array<number>;
    /* Array to record the excess time a worker takes to evaluate a document */
    overtime: Array<number>;

    /* Arrays to store user annotations, one for each document within a Hit */
    notes: Array<Array<Note>>;
    notesDone: Array<boolean>;
    /* Array of checks to understand if the annotation button should be disabled, one for each document */
    annotationsDisabled: Array<boolean>;

    /* Array of gold documents within a Hit */
    goldDocuments: Array<Document>;
    /* Array of gold dimensions within a Hit */
    goldDimensions: Array<Dimension>;

    /* Array of messages, one for each document, which indicate if the goldCheck fail message has to be shown */
    showMessageFailGoldCheck: Array<String>;

    /* Array of boolean flags to understand if there is an interaction with one of the forms. The first position is reserved for the base one,
     * and the following ones for the additional forms. So, the overall length will be "1 + post-assessment steps amount" */
    initialAssessmentFormInteraction: Array<Array<boolean>>
    /* Array of boolean flags indicating whether following assessments are allowed for each post-assessment step */
    followingAssessmentAllowed: Array<Array<boolean>>

    constructor() {
        this.dataRecords = new Array<DataRecord>()
        this.tryCurrent = 1;
        this.sequenceNumber = 0;
    }

    public getElementIndex(stepIndex) {
        let elementType = "";
        let elementIndex = 0;
        let elementLabel = "";
        if (
            stepIndex >= this.questionnaireAmountStart &&
            stepIndex < this.questionnaireAmountStart + this.documentsAmount
        ) {
            elementType = "S";
            elementIndex = stepIndex - this.questionnaireAmountStart;
            let documentCurrent = this.documents[stepIndex - this.questionnaireAmountStart];
            if (documentCurrent && documentCurrent.params && 'task_type' in documentCurrent.params) {
                const currentTaskType = (documentCurrent.params['task_type'] as string).toLowerCase();
                let elementIndexPretty = this.getDocumentTypeNumberAccordingToTaskType(documentCurrent)
                if (this.settings.element_labels) {
                    let label = Object.keys(this.settings.element_labels).find((label) => label.toLowerCase() == currentTaskType)
                    let shortLabel = Object.keys(this.settings.element_labels).find((label) => label.toLowerCase() == (currentTaskType + '_short'))

                    elementLabel = currentTaskType == "main" ? "E" : currentTaskType[0].toUpperCase()

                    if (label)
                        elementLabel = `${this.settings.element_labels[label][0].toUpperCase()}`

                    if (shortLabel)
                        elementLabel = `${this.settings.element_labels[shortLabel].toUpperCase()}`
                }
                elementLabel = `${elementLabel}${elementIndexPretty}`;
            } else {
                elementLabel = `E${this.getDocumentTypeNumberAccordingToTaskType(documentCurrent)}`
            }
        } else if (stepIndex < this.questionnaireAmountStart) {
            elementType = "Q";
            elementIndex = stepIndex;
            elementLabel = `Q${elementIndex + 1}`;
        } else if (
            stepIndex >= this.questionnaireAmountStart + this.documentsAmount &&
            stepIndex < this.getElementsNumber() &&
            this.questionnaireAmountEnd > 0
        ) {
            elementType = "Q";
            elementIndex = stepIndex - this.documentsAmount;
            elementLabel = `Q${elementIndex + 1}`;
        } else if (
            stepIndex >= this.questionnaireAmountStart + this.documentsAmount &&
            this.questionnaireAmountEnd == 0
        ) {
            elementType = "Outcome";
            elementIndex = null;
            elementLabel = null;
        } else if (
            stepIndex >= this.questionnaireAmountStart + this.documentsAmount &&
            stepIndex >= this.getElementsNumber() &&
            this.questionnaireAmountEnd > 0
        ) {
            elementType = "Outcome";
            elementIndex = null;
            elementLabel = null;
        }
        return {
            elementType: elementType,
            elementIndex: elementIndex,
            overallIndex: stepIndex,
            elementLabel: elementLabel
        };
    }

    public getElementsNumber() {
        return (this.questionnaireAmountStart + this.documentsAmount + this.questionnaireAmountEnd);
    }

    /* This function retrieves data records previously generated by the current worker. It is called just before 'performTaskSetup.' Each data record is parsed using the corresponding class.
     * The 'sequenceNumber' and 'tryCurrent' must be carefully restored to avoid inconsistencies. It's important to note that the sequence number must be incremented after data upload,
     * whether it's a 'Back' or 'Next' action. On the other hand, 'tryCurrent' should be the highest value found in the data records, i.e., the most recent one */
    public storeDataRecords(previousRecords: JSON[]) {
        for (let record of previousRecords) {
            let recordCurrent = new DataRecord(record)
            this.dataRecords.push(recordCurrent)
            this.sequenceNumber = Math.max(this.sequenceNumber, recordCurrent.sequenceNumber) + 1
            this.tryCurrent = Math.max(this.tryCurrent, recordCurrent.tryCurrent)
        }
    }

    /* This function retrieves the latest data record for the specified element type at the provided index. The 'elementType' can be either 'document' or 'questionnaire'. */
    public retrieveMostRecentDataRecord(elementType: string, index: number) {
        let dataRecords = []
        for (let dataRecord of this.dataRecords) {
            if (dataRecord.element == elementType && dataRecord.index == index && dataRecord.unitId == this.unitId)
                dataRecords.push(dataRecord)
        }
        dataRecords.sort((a, b) => a.time > b.time ? 1 : -1);
        if (dataRecords.length > 0)
            return dataRecords.slice(-1)[0]
        else
            return null

    }

    /* #################### CONFIGURATION INITIALIZATION #################### */

    public initializeDocuments(rawDocuments, documentsParams) {
        this.documents = new Array<Document>();
        this.showMessageFailGoldCheck = new Array<String>();
        /*  Each document of the current hit is parsed using the Document interface.  */
        for (let index = 0; index < rawDocuments.length; index++) {
            let currentDocument = rawDocuments[index];
            let currentParams = {} as JSON
            if (documentsParams != undefined && documentsParams[currentDocument["id"]] != undefined)
                currentParams = documentsParams[currentDocument["id"]]
            this.documents.push(new Document(index, currentDocument, currentParams));
            this.showMessageFailGoldCheck.push(null);
        }
        this.mostRecentDataRecordsForDocuments = new Array<DataRecord>(this.documentsAmount)
        for (let index = 0; index < this.documentsAmount; index++)
            this.mostRecentDataRecordsForDocuments[index] = this.retrieveMostRecentDataRecord('document', index)

        this.searchEngineQueries = new Array<object>(this.documentsAmount);
        this.currentQuery = 0;
        for (let index = 0; index < this.searchEngineQueries.length; index++) {
            this.searchEngineQueries[index] = {};
            this.searchEngineQueries[index]["data"] = [];
            this.searchEngineQueries[index]["amount"] = 0;
            if (this.mostRecentDataRecordsForDocuments[index]) {
                let existingSearchEngineQueries = this.mostRecentDataRecordsForDocuments[index].loadSearchEngineQueries()
                this.searchEngineQueries[index]["data"] = existingSearchEngineQueries.data
                this.searchEngineQueries[index]["amount"] = existingSearchEngineQueries.amount
                this.currentQuery = existingSearchEngineQueries.amount - 1
            }
        }
        this.searchEngineRetrievedResponses = new Array<object>(
            this.documentsAmount
        );
        for (let index = 0; index < this.searchEngineRetrievedResponses.length; index++) {
            this.searchEngineRetrievedResponses[index] = {};
            this.searchEngineRetrievedResponses[index]["data"] = [];
            this.searchEngineRetrievedResponses[index]["amount"] = 0;
            if (this.mostRecentDataRecordsForDocuments[index]) {
                let existingSearchEngineRetrievedResponse = this.mostRecentDataRecordsForDocuments[index].loadSearchEngineRetrievedResponses()
                this.searchEngineRetrievedResponses[index]["data"] = existingSearchEngineRetrievedResponse.data
                this.searchEngineRetrievedResponses[index]["amount"] = existingSearchEngineRetrievedResponse.amount
            }
        }
        this.searchEngineSelectedResponses = new Array<object>(
            this.documentsAmount
        );
        for (let index = 0; index < this.searchEngineSelectedResponses.length; index++) {
            this.searchEngineSelectedResponses[index] = {};
            this.searchEngineSelectedResponses[index]["data"] = [];
            this.searchEngineSelectedResponses[index]["amount"] = 0;
            if (this.mostRecentDataRecordsForDocuments[index]) {
                let existingSearchEngineSelectedResponses = this.mostRecentDataRecordsForDocuments[index].loadSearchEngineSelectedResponses()
                this.searchEngineSelectedResponses[index]["data"] = existingSearchEngineSelectedResponses.data
                this.searchEngineSelectedResponses[index]["amount"] = existingSearchEngineSelectedResponses.amount
            }
        }
        this.searchEnginePreRetrievedResults = new Array<Array<PreRetrievedResult>>(
            this.documentsAmount
        );
        for (let index = 0; index < this.searchEnginePreRetrievedResults.length; index++) {
            this.searchEnginePreRetrievedResults[index] = this.retrieveSearchEnginePreRetrievedResults(index)
        }
        this.searchEnginePreRetrievedResultsSettings = this.searchEngineSettings.pre_retrieved_results_settings
        this.notesDone = new Array<boolean>();
        this.annotationsDisabled = new Array<boolean>();
        if (this.settings.annotator) {
            switch (this.settings.annotator.type) {
                case "options":
                    this.notes = new Array<Array<NoteStandard>>(this.documentsAmount);
                    for (let i = 0; i < this.notes.length; i++)
                        this.notes[i] = [];
                    for (let index = 0; index < this.notes.length; index++)
                        this.annotationsDisabled.push(true);
                    break;
                case "laws":
                    // TODO: Add initialization from past records also for this case
                    this.notes = new Array<Array<NoteLaws>>(this.documentsAmount);
                    this.notesDone = new Array<boolean>(this.documentsAmount);
                    for (let i = 0; i < this.notes.length; i++)
                        this.notes[i] = [];
                    for (let i = 0; i < this.notesDone.length; i++)
                        this.notesDone[i] = false;
                    break;
            }
        } else {
            this.notes = new Array<Array<NoteStandard>>(this.documentsAmount);
            for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];
            for (let index = 0; index < this.notes.length; index++)
                this.annotationsDisabled.push(true);
        }

        this.documentsCountdownTime = new Array<number>(this.documentsAmount);
        this.documentsStartCountdownTime = new Array<number>(this.documentsAmount);
        this.countdownsStarted = new Array<boolean>(this.documentsAmount);
        this.countdownsExpired = new Array<boolean>(this.documentsAmount);
        this.countdownExpiredTimestamp = new Array<number>(this.documentsAmount);
        this.overtime = new Array<number>(this.documentsAmount);
        for (let index = 0; index < this.documents.length; index++) {
            this.documentsCountdownTime[index] = this.settings.countdownTime;
            if (this.mostRecentDataRecordsForDocuments[index]){
                this.documentsCountdownTime[index] = this.mostRecentDataRecordsForDocuments[index].loadCountdownTimeLeft();
                this.documentsStartCountdownTime[index] = this.mostRecentDataRecordsForDocuments[index].loadCountdownTimeStart();
                this.countdownsStarted[index] = this.mostRecentDataRecordsForDocuments[index].loadCountdownStarted();
                this.countdownsExpired[index] = this.mostRecentDataRecordsForDocuments[index].loadCountdownExpired();
                this.countdownExpiredTimestamp[index] = this.mostRecentDataRecordsForDocuments[index].loadCountdownExpiredTimestamp();
                this.overtime[index] = this.mostRecentDataRecordsForDocuments[index].loadOvertime();
            } else {
                if(this.settings.countdown_modality === "attribute" && this.settings.countdown_attribute_values.length > 0){
                    const element = this.settings.countdown_attribute_values.find(item => item["name"] === this.documents[index].fact_check_ground_truth_label);
                    if(element != undefined){
                        this.documentsCountdownTime[index] = this.documentsCountdownTime[index] + element["time"];
                    }
                }

                if(this.settings.countdown_modality === "position" && this.settings.countdown_position_values.length > 0){
                    const element = this.settings.countdown_position_values.find(item => item["position"] === this.documents[index].index);
                    if(element != undefined){
                        this.documentsCountdownTime[index] = this.documentsCountdownTime[index] + element["time"];
                    }
                }
                this.documentsStartCountdownTime[index] = this.documentsCountdownTime[index];
                this.countdownsStarted[index] = false;
                this.countdownsExpired[index] = false;
                this.countdownExpiredTimestamp[index] = -1;
                this.overtime[index] = 0;
            }
            
        }

        this.documentsPairwiseSelection = new Array<Array<boolean>>(
            this.documentsAmount
        );
        for (let i = 0; i < this.documentsPairwiseSelection.length; i++) {
            let selection = [];
            selection[0] = false;
            selection[1] = false;
            this.documentsPairwiseSelection[i] = selection;
        }
        this.goldDocuments = new Array<Document>();
        /* Indexes of the gold elements are retrieved */
        for (let index = 0; index < this.documentsAmount; index++) {
            if ("id" in this.documents[index]) {
                if (this.documents[index]["id"].includes("GOLD")) {
                    this.goldDocuments.push(this.documents[index]);
                }
            }
        }
    }

    public initializeInstructionsGeneral(rawGeneralInstructions) {
        this.instructionsGeneralAmount = rawGeneralInstructions.length;
        /* The instructions are parsed using the Instruction class */
        this.instructionsGeneral = new Array<BaseInstruction>();
        for (let index = 0; index < this.instructionsGeneralAmount; index++) {
            this.instructionsGeneral.push(new BaseInstruction(index, rawGeneralInstructions[index]));
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
            let questionnaire = new Questionnaire(index, rawQuestionnaires[index]);
            this.questionnaires.push(questionnaire);
            if (questionnaire.position == "start" || questionnaire.position == null)
                this.questionnaireAmountStart = this.questionnaireAmountStart + 1;
            if (questionnaire.position == "end")
                this.questionnaireAmountEnd = this.questionnaireAmountEnd + 1;
        }
        this.mostRecentDataRecordsForQuestionnaires = new Array<DataRecord>(this.questionnaireAmount)
        for (let index = 0; index < this.questionnaireAmount; index++)
            this.mostRecentDataRecordsForQuestionnaires[index] = this.retrieveMostRecentDataRecord('questionnaire', index)
    }

    public initializeInstructionsEvaluation(rawEvaluationInstructions) {
        this.instructionsEvaluationGeneralAmount = !!rawEvaluationInstructions["instructions"] ? rawEvaluationInstructions["instructions"].length : 0;
        this.instructionsEvaluation = new EvaluationInstruction(
            rawEvaluationInstructions
        );
    }

    public initializeDimensions(rawDimensions) {
        /* The array of dimensions is initialized */
        this.dimensions = new Array<Dimension>();
        this.dimensionsAmount = rawDimensions.length;
        /* Each dimension is parsed using the Dimension class */
        for (let index = 0; index < this.dimensionsAmount; index++)
            this.dimensions.push(new Dimension(index, rawDimensions[index]));

        this.dimensionsSelectedValues = new Array<object>(this.documentsAmount);
        for (let index = 0; index < this.dimensionsSelectedValues.length; index++) {
            this.dimensionsSelectedValues[index] = {};
            this.dimensionsSelectedValues[index]["data"] = [];
            this.dimensionsSelectedValues[index]["amount"] = 0;
            if (this.mostRecentDataRecordsForDocuments) {
                if (this.mostRecentDataRecordsForDocuments[index]) {
                    let existingDimensionsSelectedValues = this.mostRecentDataRecordsForDocuments[index].loadDimensionsSelected()
                    this.dimensionsSelectedValues[index]["data"] = existingDimensionsSelectedValues.data
                    this.dimensionsSelectedValues[index]["amount"] = existingDimensionsSelectedValues.amount
                }
            }
        }

        /* Checks if there are interval scales among the dimensions */
        if (this.dimensions.some(dimension => dimension.scale instanceof ScaleInterval)) {
            let intervalDimesions = this.dimensions.find(dimension => dimension.scale instanceof ScaleInterval);

            /* Initialize the arrays of interval min and max values for each document */
            this.dimensionIntervalMinValues = new Array<number>(this.documentsAmount);
            this.dimensionIntervalMaxValues = new Array<number>(this.documentsAmount);

            if (intervalDimesions.scale instanceof ScaleInterval) {
                for (let index = 0; index < this.documentsAmount; index++) {
                    /* Check if there is a video attribute in the task attributes and a HITS element called "video_duration"*/
                    if(this.settings.attributesMain.some(attribute => attribute.is_video) && this.documents[index]['video_duration']) {
                        /* Set the max interval value to the duration of the video */
                        this.dimensionIntervalMaxValues[index] = this.documents[index]['video_duration'];
                    }
                    /* Otherwise create and array with the default value setted in the dimension.json file */
                    else {
                        this.dimensionIntervalMaxValues[index] = intervalDimesions.scale.max;
                    }
                    /* Set the min interval value to the default value setted in the dimension.json file */
                    this.dimensionIntervalMinValues[index] = intervalDimesions.scale.min;
                }
            }
        }

        /* @Cristian Abbondo: Defines a three-dimensional array for element selection.
         * TODO: Initialize from past payloads for dimensionsPairwiseSelection as well. */
        for (let i = 0; i < this.documentsAmount; i++) {
            this.dimensionsPairwiseSelection[i] = [];
            for (let j = 0; j < this.dimensionsAmount; j++) {
                this.dimensionsPairwiseSelection[i][j] = [];
                this.dimensionsPairwiseSelection[i][j][0] = false;
                this.dimensionsPairwiseSelection[i][j][1] = false;
            }
        }

        this.goldDimensions = new Array<Dimension>();
        /* Indexes of the gold dimensions are retrieved */
        for (let index = 0; index < this.dimensionsAmount; index++) {
            if (this.dimensions[index].gold) {
                this.goldDimensions.push(this.dimensions[index]);
            }
        }
    }

    public initializeTimestamps() {
        /* Arrays of start, end and elapsed timestamps are initialized to track how much time the worker spends
         * on each document, including each questionnaire */
        this.timestampsStart = new Array<Array<number>>(this.getElementsNumber());
        this.timestampsEnd = new Array<Array<number>>(this.getElementsNumber());
        this.timestampsElapsed = new Array<number>(this.getElementsNumber());
        for (let i = 0; i < this.timestampsStart.length; i++) {
            this.timestampsStart[i] = [];
            if (this.getElementIndex(i)['elementType'] == 'Q') {
                let mostRecentDataRecord = this.mostRecentDataRecordsForQuestionnaires[this.getElementIndex(i)['elementIndex']]
                if (mostRecentDataRecord) {
                    this.timestampsStart[i] = mostRecentDataRecord.loadTimestampsStart()
                }
            } else {
                let mostRecentDataRecord = this.mostRecentDataRecordsForDocuments[this.getElementIndex(i)['elementIndex']]
                if (mostRecentDataRecord)
                    this.timestampsStart[i] = mostRecentDataRecord.loadTimestampsStart()
            }
        }
        for (let i = 0; i < this.timestampsEnd.length; i++) {
            this.timestampsEnd[i] = [];
            if (this.getElementIndex(i)['elementType'] == 'Q') {
                let mostRecentDataRecord = this.mostRecentDataRecordsForQuestionnaires[this.getElementIndex(i)['elementIndex']]
                if (mostRecentDataRecord) {
                    this.timestampsEnd[i] = mostRecentDataRecord.loadTimestampsEnd()
                }
            } else {
                let mostRecentDataRecord = this.mostRecentDataRecordsForDocuments[this.getElementIndex(i)['elementIndex']]
                if (mostRecentDataRecord)
                    this.timestampsEnd[i] = mostRecentDataRecord.loadTimestampsEnd()
            }
        }
        for (let i = 0; i < this.timestampsElapsed.length; i++) {
            if (this.getElementIndex(i)['elementType'] == 'Q') {
                let mostRecentDataRecord = this.mostRecentDataRecordsForQuestionnaires[this.getElementIndex(i)['elementIndex']]
                if (mostRecentDataRecord)
                    this.timestampsElapsed[i] = mostRecentDataRecord.loadTimestampsElapsed()
            } else {
                let mostRecentDataRecord = this.mostRecentDataRecordsForDocuments[this.getElementIndex(i)['elementIndex']]
                if (mostRecentDataRecord)
                    this.timestampsElapsed[i] = mostRecentDataRecord.loadTimestampsElapsed()
            }
        }
    }

    public initializeAccessCounter() {
        /* Initializes the array of access counters. */
        let elementsAmount = this.getElementsNumber();
        this.elementsAccesses = new Array<number>(elementsAmount);
        for (let index = 0; index < this.elementsAccesses.length; index++) {
            this.elementsAccesses[index] = 0;
            if (this.getElementIndex(index)['elementType'] == 'Q') {
                let mostRecentDataRecord = this.mostRecentDataRecordsForQuestionnaires[this.getElementIndex(index)['elementIndex']]
                if (mostRecentDataRecord) {
                    this.elementsAccesses[index] = mostRecentDataRecord.loadAccesses()
                }
            } else {
                let mostRecentDataRecord = this.mostRecentDataRecordsForDocuments[this.getElementIndex(index)['elementIndex']]
                if (mostRecentDataRecord)
                    this.elementsAccesses[index] = mostRecentDataRecord.loadAccesses()
            }
        }
    }

    public initializePostAssessment() {
        this.initialAssessmentFormInteraction = Array(this.documents.length)
        this.followingAssessmentAllowed = Array(this.documents.length)
        for (let index = 0; index < this.documents.length; index++) {
            if (this.settings.post_assessment) {
                /* The '+1' indicates that the count includes the base assessment form as well. */
                this.initialAssessmentFormInteraction[index] = Array(this.settings.attributesPost.length + 1).fill(false);
                this.followingAssessmentAllowed[index] = Array(this.settings.attributesPost.length + 1).fill(false);
            } else {
                this.initialAssessmentFormInteraction[index] = Array(0)
                this.followingAssessmentAllowed[index] = Array(0)
            }
        }
    }

    /* #################### GOLD CHECKS #################### */

    public generateGoldConfiguration(goldDocuments, goldDimensions, documentsForm, notes) {
        let goldConfiguration = [];

        /* For each gold document its attribute, answers and notes are retrieved to build a gold configuration */
        for (let goldDocument of goldDocuments) {
            if (goldDocument.index < documentsForm.length) {
                let currentConfiguration = {};
                currentConfiguration["document"] = goldDocument;
                let answers = {};
                for (let goldDimension of goldDimensions) {
                    for (let [attribute, value] of Object.entries(
                        documentsForm[goldDocument.index].value
                    )) {
                        let dimensionName = attribute.split("_")[0];
                        if (dimensionName == goldDimension.name) {
                            answers[attribute] = goldDimension.scale && goldDimension.scale instanceof ScaleMagnitude ? +String(value).replace(/,/g, "") : value;
                        }
                    }
                }
                currentConfiguration["answers"] = answers;
                currentConfiguration["notes"] = notes ? notes[goldDocument.index] : [];
                goldConfiguration.push(currentConfiguration);
            }
        }

        return goldConfiguration;
    }

    public getTimesCheckAmount() {
        let times = []
        let timeCheckAmount = this.settings.time_check_amount;

        for (let i = 0; i < this.questionnaireAmount + this.documentsAmount; i++) {
            let currentTime

            if (typeof timeCheckAmount === 'number')
                currentTime = timeCheckAmount
            else {
                currentTime = timeCheckAmount["default"]
                if (i >= this.questionnaireAmountStart && i < this.questionnaireAmountStart + this.documentsAmount) {

                    if (timeCheckAmount["document"])
                        currentTime = timeCheckAmount["document"]

                    let currentTaskType = this.documents[i - this.questionnaireAmountStart]["params"]["task_type"]

                    if (timeCheckAmount["document_task_type"]) {
                        let taskType = Object.keys(timeCheckAmount["document_task_type"]).find((t) => t.toLowerCase() == currentTaskType.toLowerCase())
                        if (taskType)
                            currentTime = timeCheckAmount["document_task_type"][taskType]
                    }

                    let currentId = this.documents[i - this.questionnaireAmountStart]["id"]
                    if (timeCheckAmount["document_id"] && timeCheckAmount["document_id"][currentId])
                        currentTime = timeCheckAmount["document_id"][currentId]

                } else {

                    if (timeCheckAmount["questionnaire"])
                        currentTime = timeCheckAmount["questionnaire"]

                    let isStart = i < this.questionnaireAmountStart
                    if (timeCheckAmount["questionnaire_position_start"] && isStart)
                        currentTime = timeCheckAmount["questionnaire_position_start"]
                    if (timeCheckAmount["questionnaire_position_end"] && !isStart)
                        currentTime = timeCheckAmount["questionnaire_position_end"]

                    let idx = isStart ? i : i - this.documentsAmount
                    let currentName = this.questionnaires[idx]["name"]
                    if (timeCheckAmount["questionnaire_name"] && timeCheckAmount["questionnaire_name"][currentName])
                        currentTime = timeCheckAmount["questionnaire_name"][currentName]
                }
            }
            times.push(currentTime)
        }
        return times
    }

    /* #################### DIMENSION HANDLING #################### */

    /* This function is used to sort each dimension that a worker have to assess according the position specified */
    public filterDimensions(kind: string, position: string) {
        let filteredDimensions = [];
        for (let dimension of this.dimensions) {
            if (dimension.style) {
                if (
                    dimension.style.type == kind &&
                    dimension.style.position == position
                )
                    filteredDimensions.push(dimension);
            }
        }
        return filteredDimensions;
    }

    public verifyDimensionsQuantity(position) {
        let dimensionsToCheck = [];
        for (let dimension of this.dimensions) {
            if (dimension.style.position == position) {
                dimensionsToCheck.push(dimension);
            }
        }
        return dimensionsToCheck.length;
    }

    public retrieveFirstDimension(position) {
        let dimensionFirst = null;
        for (let dimension of this.dimensions) {
            if (dimension.style.position == position && dimension.scale) {
                dimensionFirst = dimension;
                break;
            }
        }
        return dimensionFirst;
    }

    /*
     * This function intercepts a <changeEvent> triggered by the value controls of a dimension.
     * The parameters are:
     * - A JSON object that holds the selected value.
     * - A reference to the current document.
     * - A reference to the current dimension.
     * This array can be empty if the worker does not select any value and leaves the task or if a dimension does not require a value.
     * This information is parsed and stored in the corresponding data structure.
     */
    public storeDimensionValue(
        eventData,
        document: number,
        dimension: number,
        postAssessment: number = null,
        justification: boolean = false
    ) {
        /* The event triggered by a MatRadioButton is an object with two keys: 'source' and 'value'. The latter contains the selected value. */
        /* The event triggered by a MatInput, on the other hand, is a complex object stored with the 'source' key.
         * This time, the value can be accessed by exploring the 'target' attribute within the 'source' object. */
        let currentValue = String(Object.keys(eventData).includes('value') ? eventData.value : eventData.target.value)
        /* The current document, dimension and user query are copied from parameters */
        let currentDocument = document;
        let currentDimension = dimension;
        /* A reference to the current dimension is saved */
        this.currentDimension = currentDimension;
        let timeInSeconds = Date.now() / 1000;
        let prevSelectionTimestamp = -1;
        /* If some data for the current document already exists*/
        if (this.dimensionsSelectedValues[currentDocument]["amount"] > 0) {
            /* The new query is pushed into current document data array along with a document_index used to identify such query*/
            let selectedValues = Object.values(
                this.dimensionsSelectedValues[currentDocument]["data"]
            );
            prevSelectionTimestamp = this.dimensionsSelectedValues[currentDocument]["data"][selectedValues.length - 1]["timestamp"]
            let selectedValue = {
                document: currentDocument,
                dimension: currentDimension,
                index: selectedValues.length,
                timestamp: timeInSeconds,
                value: currentValue,
            }
            if (postAssessment)
                selectedValue['post_assessment'] = postAssessment
            /* If the justification flag is true, the current value represents the justification required for the current dimension. Therefore, the payload is adjusted accordingly */
            if (justification) {
                delete selectedValue['value']
                selectedValue['justification'] = currentValue
            }
            selectedValues.push(selectedValue);
            /* The data array within the data structure is updated */
            this.dimensionsSelectedValues[currentDocument]["data"] = selectedValues;
            /* The total amount of selected values for the current document is updated */
            this.dimensionsSelectedValues[currentDocument]["amount"] = selectedValues.length;
        } else {
            /* The data slot for the current document is created */
            this.dimensionsSelectedValues[currentDocument] = {};
            /* A new data array for the current document is created and the fist selected value is pushed */
            let selectedValue = {
                document: currentDocument,
                dimension: currentDimension,
                index: 0,
                timestamp: timeInSeconds,
                value: currentValue,
            }
            if (postAssessment)
                selectedValue['post_assessment'] = postAssessment
            if (justification) {
                delete selectedValue['value']
                selectedValue['justification'] = currentValue
            }
            this.dimensionsSelectedValues[currentDocument]["data"] = [selectedValue];
            /* The total amount of selected values for the current document is set to 1. */
            /* IMPORTANT: The document_index of the last selected value for a document will be <amount - 1>. */
            this.dimensionsSelectedValues[currentDocument]["amount"] = 1;
        }

        /* If the document has an (expired) countdown and the modality is hide_attributes, we compute the excess time */
        if(this.hasCountdown() && this.settings.countdown_behavior === 'hide_attributes' && this.countdownsExpired[currentDocument]){
            const element = [...Array(this.getElementsNumber()).keys()].find(i => this.getElementIndex(i).elementIndex == currentDocument);
            if(this.overtime[currentDocument] > 0)
                this.overtime[currentDocument] += timeInSeconds - Math.max(this.timestampsStart[element][this.timestampsStart[element].length - 1], prevSelectionTimestamp, this.countdownExpiredTimestamp[currentDocument])
            else
                this.overtime[currentDocument] = timeInSeconds - this.countdownExpiredTimestamp[currentDocument]
        }
    }

    /*
     * This function intercepts a <queryEmitter> triggered by an instance of the search engine.
     * The parameter is a JSON object that holds the query typed by the worker within a given document.
     * This information is parsed and stored in the corresponding data structure.
     */
    public storeSearchEngineUserQuery(
        queryData: Object,
        document: Document,
        dimension: Dimension
    ) {
        this.currentDimension = dimension.index;
        let currentQueryText = queryData["text"];
        let currentQueryTextEncoded = queryData["encoded"];
        let timeInSeconds = Date.now() / 1000;
        /* If some data for the current document already exists*/
        if (this.searchEngineQueries[document.index]["amount"] > 0) {
            /* The new query is pushed into current document data array along with a document_index used to identify such query*/
            let storedQueries = Object.values(
                this.searchEngineQueries[document.index]["data"]
            );
            storedQueries.push({
                document: document.index,
                dimension: dimension.index,
                index: storedQueries.length,
                timestamp: timeInSeconds,
                text: currentQueryText,
                textEncoded: currentQueryTextEncoded,
            });
            this.currentQuery = storedQueries.length - 1;
            /* The data array within the data structure is updated */
            this.searchEngineQueries[document.index]["data"] = storedQueries;
            /* The total amount of query for the current document is updated */
            this.searchEngineQueries[document.index]["amount"] =
                storedQueries.length;
        } else {
            /* The data slot for the current document is created */
            this.searchEngineQueries[document.index] = {};
            /* A new data array for the current document is created and the fist query is pushed */
            this.searchEngineQueries[document.index]["data"] = [
                {
                    document: document.index,
                    dimension: dimension.index,
                    index: 0,
                    timestamp: timeInSeconds,
                    text: currentQueryText,
                    textEncoded: currentQueryTextEncoded,
                },
            ];
            this.currentQuery = 0;
            /* The total amount of query for the current document is set to 1 */
            /* IMPORTANT: the document_index of the last query inserted for a document will be <amount -1> */
            this.searchEngineQueries[document.index]["amount"] = 1;
        }
    }

    public retrieveLatestQuery(documentIndex: number) {
        let queryAmount = this.searchEngineQueries[documentIndex]["amount"]
        if (queryAmount > 0)
            return this.searchEngineQueries[documentIndex]["data"][queryAmount - 1];
        return null
    }

    /*
     * This function intercepts a <resultEmitter> triggered by an instance of the search engine.
     * The parameter is a JSON object which holds an array of <BaseResponse> objects, one for each search result.
     * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
     * These information are parsed and stored in the corresponding data structure.
     */
    public storeSearchEngineRetrievedResponse(
        retrievedResponseData: Object,
        document: Document,
        dimension: Dimension
    ) {
        let currentRetrievedResponses = retrievedResponseData['decodedResponses'];
        let timeInSeconds = Date.now() / 1000;
        /* If some responses for the current document already exists*/
        if (this.searchEngineRetrievedResponses[document.index]["groups"] > 0) {
            /* The new response is pushed into current document data array along with its query document_index */
            let storedResponses = Object.values(
                this.searchEngineRetrievedResponses[document.index]["data"]
            );
            storedResponses.push({
                document: document.index,
                dimension: dimension.index,
                query: this.searchEngineQueries[document.index]["amount"] - 1,
                index: storedResponses.length,
                timestamp: timeInSeconds,
                estimated_matches: retrievedResponseData['estimatedMatches'],
                results_retrieved: retrievedResponseData['resultsRetrieved'],
                results_to_skip: retrievedResponseData['resultsToSkip'],
                results_amount: retrievedResponseData['resultsAmount'],
                page_index: retrievedResponseData['pageIndex'],
                page_size: retrievedResponseData['pageSize'],
                response: currentRetrievedResponses
            });
            /* The data array within the data structure is updated */
            this.searchEngineRetrievedResponses[document.index]["data"] = storedResponses;
            /* The total amount retrieved responses for the current document is updated */
            this.searchEngineRetrievedResponses[document.index]["amount"] = this.searchEngineRetrievedResponses[document.index]["amount"] + currentRetrievedResponses.length;
            /* The total amount of groups of retrieved responses for the current document is updated */
            this.searchEngineRetrievedResponses[document.index]["groups"] = storedResponses.length;
        } else {
            /* The data slot for the current document is created */
            this.searchEngineRetrievedResponses[document.index] = {};
            /* A new data array for the current document is created and the fist response is pushed */
            this.searchEngineRetrievedResponses[document.index]["data"] = [
                {
                    document: document.index,
                    dimension: dimension.index,
                    query: this.searchEngineQueries[document.index]["amount"] - 1,
                    index: 0,
                    timestamp: timeInSeconds,
                    estimated_matches: retrievedResponseData['estimatedMatches'],
                    results_retrieved: retrievedResponseData['resultsRetrieved'],
                    results_to_skip: retrievedResponseData['resultsToSkip'],
                    results_amount: retrievedResponseData['resultsAmount'],
                    page_index: retrievedResponseData['pageIndex'],
                    page_size: retrievedResponseData['pageSize'],
                    response: currentRetrievedResponses
                },
            ];
            /* The total amount of retrieved responses for the current document is set to the length of the first group */
            /* IMPORTANT: the document_index of the last retrieved response for a document will be <amount -1> */
            this.searchEngineRetrievedResponses[document.index]["amount"] = currentRetrievedResponses.length;
            /* The total amount of groups retrieved responses for the current document is set to 1 */
            this.searchEngineRetrievedResponses[document.index]["groups"] = 1;
        }
    }

    /*
     * This function intercepts a <selectedRowEmitter> triggered by an instance of the search engine.
     * The parameter is a JSON object which holds the selected search engine result within a given document.
     * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
     * These information are parsed and stored in the corresponding data structure.
     */
    public storeSearchEngineSelectedResponse(
        selectedResponseData: Object,
        document: Document,
        dimension: Dimension
    ) {
        let currentSelectedResponse = selectedResponseData;
        let timeInSeconds = Date.now() / 1000;
        /* If some responses for the current document already exists*/
        if (this.searchEngineSelectedResponses[document.index]["amount"] > 0) {
            /* The new response is pushed into current document data array along with its query document_index */
            let storedResponses = Object.values(
                this.searchEngineSelectedResponses[document.index]["data"]
            );
            storedResponses.push({
                document: document.index,
                dimension: dimension.index,
                query: this.searchEngineQueries[document.index]["amount"] - 1,
                index: storedResponses.length,
                timestamp: timeInSeconds,
                response: currentSelectedResponse,
            });
            /* The data array within the data structure is updated */
            this.searchEngineSelectedResponses[document.index]["data"] =
                storedResponses;
            /* The total amount of selected responses for the current document is updated */
            this.searchEngineSelectedResponses[document.index]["amount"] =
                storedResponses.length;
        } else {
            /* The data slot for the current document is created */
            this.searchEngineSelectedResponses[document.index] = {};
            /* A new data array for the current document is created and the fist response is pushed */
            this.searchEngineSelectedResponses[document.index]["data"] = [
                {
                    document: document.index,
                    dimension: dimension.index,
                    query:
                        this.searchEngineQueries[document.index]["amount"] - 1,
                    index: 0,
                    timestamp: timeInSeconds,
                    response: currentSelectedResponse,
                },
            ];
            /* The total amount of selected responses for the current document is set to 1 */
            /* IMPORTANT: the document_index of the last selected response for a document will be <amount -1> */
            this.searchEngineSelectedResponses[document.index]["amount"] = 1;
        }
    }

    public retrieveSearchEnginePreRetrievedResults(documentIndex: number) {
        let documentCurrent = this.documents[documentIndex]
        let preRetrievedResults: Array<PreRetrievedResult> = []
        for (let resultPreRetrieved of this.searchEngineSettings.pre_retrieved_results) {
            if (resultPreRetrieved.elementID == documentCurrent['id']) {
                preRetrievedResults.push(resultPreRetrieved)
            }
        }
        return preRetrievedResults
    }

    public retrieveSearchEnginePreRetrievedResult(resultUUID: string) {
        for (let resultPreRetrieved of this.searchEngineSettings.pre_retrieved_results) {
            if ((resultPreRetrieved.resultUUID == resultUUID)) {
                return resultPreRetrieved
            }
        }
        return null
    }

    public isSearchEnginePreRetrievedResultVisited(resultUUID: string) {
        let preRetrievedSearchResult = this.retrieveSearchEnginePreRetrievedResult(resultUUID)
        if (preRetrievedSearchResult)
            return preRetrievedSearchResult.visited
        return false
    }

    /*
     * This function checks if each undeleted note of a document has a corresponding
     * option; if this is true the worker can proceed to the following element
     */
    public checkAnnotationConsistency(documentIndex: number) {
        let requiredAttributes = [];
        for (let attribute of this.settings.attributesMain) {
            if (attribute.required) {
                requiredAttributes.push(attribute.index);
            }
        }
        let check = false;
        this.notes[documentIndex].forEach((element) => {
            if (element instanceof NoteStandard) {
                if (!element.deleted && element.option != "not_selected") {
                    const index = requiredAttributes.indexOf(
                        element.attribute_index
                    );
                    if (index > -1) {
                        requiredAttributes.splice(index, 1);
                    }
                    check = true;
                }
            } else {
                if (!element.deleted) check = true;
            }
        });
        if (requiredAttributes.length > 0) {
            check = false;
        }
        if (!this.settings.annotator) {
            check = true;
        }
        return check;
    }

    public checkAtLeastOneDocumentSelected(documentIndex: number) {
        let atLeastOneDocument = false;
        for (let selection of this.documentsPairwiseSelection[documentIndex]) {
            if (selection) atLeastOneDocument = true;
        }
        return atLeastOneDocument;
    }

    /*
     * This function checks the presence of undeleted worker's notes. If there it as least one undeleted note, the summary table is shown
     */
    public checkUndeletedNotesPresence(notes) {
        let undeletedNotes = false;
        for (let note of notes) {
            if (note.deleted == false && note.option != "not_selected") {
                undeletedNotes = true;
                break;
            }
        }
        return undeletedNotes;
    }

    /* #################### TASK TYPE HANDLING #################### */

    public getDocumentTypeNumberAccordingToTaskType(doc: Document) {
        let count = 0
        for (let index = 0; index <= doc.index; index++) {
            if (doc.params['task_type'].toLowerCase() == this.documents[index].params['task_type'].toLowerCase())
                count++;
        }
        return count;
    }

    public checkCurrentTaskType(document: Document, taskTypesList) {
        return !taskTypesList ? taskTypesList !== false : taskTypesList === true || taskTypesList.some(type => type.toLowerCase() === document.params['task_type'].toLowerCase())
    }

    /* #################### POST ASSESSMENT #################### */
    public getAttributeForPostAssessmentStep(postAssessmentIndex: number) {
        for (let attributeMain of this.settings.attributesMain) {
            for (let attributePost of this.settings.attributesPost) {
                if (attributePost.index == postAssessmentIndex && attributeMain.name == attributePost.name) {
                    return attributePost
                }
            }
        }
        return null
    }

    public getFirstPostAssessmentStepInWhichDimensionAppears(dimensionName: string) {
        let firstOccurrence = 0
        let dimension = null
        for (let dimensionCurr of this.dimensions) {
            if (dimensionCurr.name == dimensionName)
                dimension = dimensionCurr
        }
        for (let dimensionPost of this.settings.dimensionsPost) {
            if (dimension.name == dimensionPost.name) {
                for (let postAssessmentIndex of dimensionPost.indexes) {
                    firstOccurrence = Math.max(firstOccurrence, postAssessmentIndex)
                }
            }
        }
        return firstOccurrence
    }

    public getAllPostAssessmentStepsInWhichDimensionAppears(dimensionName: string) {
        let dimension = null
        let indexes = []
        for (let dimensionCurr of this.dimensions) {
            if (dimensionCurr.name == dimensionName)
                dimension = dimensionCurr
        }
        for (let dimensionPost of this.settings.dimensionsPost) {
            if (dimension.name == dimensionPost.name) {
                indexes = dimensionPost.indexes
            }
        }
        return indexes
    }

    public retrieveIndexOfLastPostAssessmentStep() {
        let highestIndex = 0
        for (let attributePostAssessment of this.settings.attributesPost) {
            highestIndex = Math.max(highestIndex, attributePostAssessment.index)
        }
        return highestIndex
    }

    public retrieveMostRecentAnswersForPostAssessment(documentIndex: number, postAssessmentIndex: number) {
        let mostRecentDataRecord = this.mostRecentDataRecordsForDocuments[documentIndex]
        let dimensions = this.dimensions;
        let controlSuffix = `_post_${postAssessmentIndex}`
        let postAssessmentAnswers = {}
        if (mostRecentDataRecord) {
            let answers = mostRecentDataRecord.loadAnswers()
            for (const [answer, value] of Object.entries(answers)) {
                for (let dimension of dimensions) {
                    if (
                        (answer == `${dimension.name}_justification${controlSuffix}`) ||
                        (answer == `${dimension.name}_value${controlSuffix}`) ||
                        (answer == `${dimension.name}_list${controlSuffix}`)
                    ) {
                        postAssessmentAnswers[answer] = value
                    }
                }
            }
        }
        return postAssessmentAnswers
    }

    /* #################### PAYLOADS #################### */

    public buildTaskInitialPayload(worker) {
        let data = {};
        let actionInfo = {
            try: this.tryCurrent,
            sequence: this.sequenceNumber,
            element: "data",
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
            settings: this.settings,
            search_engine_settings: this.searchEngineSettings,
            search_engine_results_retrieved: {},
            search_engine_results_retrieved_settings: this.searchEnginePreRetrievedResultsSettings,
        };
        data["info"] = actionInfo;
        /* General info about task */
        /* Given that a scenario involves pre-retrieving a set of search results, the resulting payload can become too big for DynamoDB.
        *  Therefore, the set of pre-retrieved results is simplified using their IDs only and stored under the search_engine_results_retrieved key. */
        let searchEngineSettingsCopy = { ...this.searchEngineSettings };
        let preRetrievedResultsSimplified = {}
        for (let preRetrievedResult of searchEngineSettingsCopy.pre_retrieved_results) {
            if (!(preRetrievedResult.elementID in preRetrievedResultsSimplified))
                preRetrievedResultsSimplified[preRetrievedResult.elementID] = []
            preRetrievedResultsSimplified[preRetrievedResult.elementID].push(preRetrievedResult.resultUUID)
        }
        delete searchEngineSettingsCopy.pre_retrieved_results
        taskData['search_engine_settings'] = searchEngineSettingsCopy
        taskData['search_engine_results_retrieved'] = preRetrievedResultsSimplified
        data["task"] = taskData;
        /* The answers of the current worker to the questionnaire */
        let questionnaires = [];
        for (let questionnaire of this.questionnaires) {
            questionnaires.push(questionnaire.serializable());
        }
        data["questionnaires"] = questionnaires;
        /* The parsed document contained in current worker's hit */
        data["documents"] = this.documents;
        /* The dimensions of the answers of each worker */
        data["dimensions"] = this.dimensions;
        /* General info about worker */
        data["worker"] = worker;
        return data;
    }

    public buildTaskQuestionnairePayload(elementData, answers, action) {
        /* If the worker has completed the first questionnaire
         * The partial data about the completed questionnaire are uploaded */
        let data = {};
        let questionnaire = this.questionnaires[elementData['elementIndex']];
        let actionInfo = {
            action: action,
            access: this.elementsAccesses[elementData['overallIndex']],
            try: this.tryCurrent,
            index: elementData['elementIndex'],
            sequence: this.sequenceNumber,
            element: "questionnaire",
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo;
        /* Worker's answers to the current questionnaire */
        let questionsFull = [];
        for (let question of questionnaire.questions) {
            if (!question.dropped) questionsFull.push(question);
        }
        data["questions"] = questionsFull;
        data["answers"] = answers;
        /* Start, end and elapsed timestamps for the current questionnaire */

        let timestampsStart = this.timestampsStart[elementData['overallIndex']];
        data["timestamps_start"] = timestampsStart;
        let timestampsEnd = this.timestampsEnd[elementData['overallIndex']];
        data["timestamps_end"] = timestampsEnd;
        let timestampsElapsed = this.timestampsElapsed[elementData['overallIndex']];
        data["timestamps_elapsed"] = timestampsElapsed;
        /* Number of accesses to the current questionnaire */
        data["accesses"] = this.elementsAccesses[elementData['overallIndex']];

        return data;
    }

    public buildTaskDocumentPayload(elementData, answers, additionalAnswers = {}, countdown, action) {
        /* If the worker has completed the first questionnaire
         * The partial data about the completed questionnaire are uploaded */
        let data = {};
        let actionInfo = {
            action: action,
            access: this.elementsAccesses[elementData['overallIndex']],
            try: this.tryCurrent,
            index: elementData['elementIndex'],
            sequence: this.sequenceNumber,
            element: "document",
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo;
        /* Worker's answers for the current document */
        for (let [attribute, value] of Object.entries(answers)) {
            let answerDimensionName = attribute.split("_")[0];
            for (let dimension of this.dimensions) {
                if (answerDimensionName == dimension.name) {
                    answers[attribute] = dimension.scale && dimension.scale instanceof ScaleMagnitude ? +String(value).replace(/,/g, "") : value;
                    break
                }
            }
        }
        for (let [additionalAnswerName, value] of Object.entries(additionalAnswers)) {
            answers[additionalAnswerName] = value
        }
        data["answers"] = answers;
        let notes = this.settings.annotator ? this.notes[elementData['elementIndex']] : [];
        data["notes"] = notes;
        /* Worker's dimensions selected values for the current document */
        let dimensionsSelectedValues = this.dimensionsSelectedValues[elementData['elementIndex']];
        data["dimensions_selected"] = dimensionsSelectedValues;
        /* Worker's search engine queries for the current document */
        let searchEngineQueries = this.searchEngineQueries[elementData['elementIndex']];
        data["queries"] = searchEngineQueries;
        /* Start, end and elapsed timestamps for the current document */
        let timestampsStart = this.timestampsStart[elementData['overallIndex']];
        data["timestamps_start"] = timestampsStart;
        let timestampsEnd = this.timestampsEnd[elementData['overallIndex']];
        data["timestamps_end"] = timestampsEnd;
        let timestampsElapsed = this.timestampsElapsed[elementData['overallIndex']];
        data["timestamps_elapsed"] = timestampsElapsed;
        /* Countdown time and corresponding flag */
        let countdownTimeStart = this.settings.countdownTime >= 0 ? this.documentsStartCountdownTime[elementData['elementIndex']] : [];
        data["countdowns_times_start"] = countdownTimeStart;
        let countdownTime = this.settings.countdownTime >= 0 ? countdown : [];
        data["countdowns_times_left"] = countdownTime;
        let countdown_started = this.settings.countdownTime >= 0 ? this.countdownsStarted[elementData['elementIndex']] : [];
        data["countdowns_started"] = countdown_started;
        let countdown_expired = this.settings.countdownTime >= 0 ? this.countdownsExpired[elementData['elementIndex']] : [];
        data["countdowns_expired"] = countdown_expired;
        let countdown_expired_timestamp = this.settings.countdownTime >= 0 ? this.countdownExpiredTimestamp[elementData['elementIndex']] : [];
        let overtime = this.settings.countdownTime >= 0 ? this.overtime[elementData['elementIndex']] : [];
        data['countdown_expired_timestamp'] = countdown_expired_timestamp;
        data['overtime'] = overtime;
        /* Number of accesses to the current document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
        data["accesses"] = this.elementsAccesses[elementData['overallIndex']];
        /* Responses retrieved by search engine for each worker's query for the current document */
        let responsesRetrieved = this.searchEngineRetrievedResponses[elementData['elementIndex']];
        data["responses_retrieved"] = responsesRetrieved;
        /* Responses by search engine ordered by worker's click for the current document */
        let responsesSelected = this.searchEngineSelectedResponses[elementData['elementIndex']];
        data["responses_selected"] = responsesSelected;

        return data;
    }

    public buildQualityChecksPayload(qualityChecks) {
        let checks = {};
        checks["info"] = {
            try: this.tryCurrent,
            sequence: this.sequenceNumber,
            element: "checks",
        };
        checks["checks"] = qualityChecks;
        return checks;
    }

    public buildCommentPayload(comment) {
        let data = {};
        let actionInfo = {
            try: this.tryCurrent,
            sequence: this.sequenceNumber,
            element: "comment",
        };
        data["info"] = actionInfo;
        data["comment"] = comment;
        this.sequenceNumber = this.sequenceNumber + 1;
        return data;
    }

    public hasCountdown(){
        return this.settings.countdownTime >= 0;
    }
}
