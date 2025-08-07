/* Core */
import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import {
    UntypedFormArray,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from "@angular/forms";
/* Services */
import { ConfigService } from "../../../../services/config.service";

import { LocalStorageService } from "../../../../services/localStorage.service";
/* Models */
import { Questionnaire } from "../../../../models/skeleton/questionnaires/questionnaire";
import { Question } from "../../../../models/skeleton/questionnaires/question";
import { S3Service } from "../../../../services/aws/s3.service";

/* STEP #1 - Questionnaires */

interface QuestionnaireType {
    value: string;
    viewValue: string;
}

interface QuestionnairePosition {
    value: string;
    viewValue: string;
}

@Component({
    selector: "app-questionnaire-step",
    templateUrl: "./questionnaire-step.component.html",
    styleUrls: ["../../generator.component.scss"],
    standalone: false
})
export class QuestionnaireStepComponent implements OnInit {
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    /* STEP #1 - Questionnaires */

    dataStored: Array<Questionnaire>;

    formStep: UntypedFormGroup;

    questionnaireTypes: QuestionnaireType[] = [
        { value: "crt", viewValue: "CRT" },
        { value: "likert", viewValue: "Likert" },
        { value: "standard", viewValue: "Standard" },
    ];
    questionnairePosition: QuestionnairePosition[] = [
        { value: "start", viewValue: "Start" },
        { value: "end", viewValue: "End" },
    ];

    configurationSerialized: string;

    @Output() formEmitter: EventEmitter<UntypedFormGroup>;

    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        private _formBuilder: UntypedFormBuilder
    ) {
        this.configService = configService;
        this.S3Service = S3Service;
        this.localStorageService = localStorageService;
        this.initializeControls();
    }

    public initializeControls() {
        this.dataStored = [];
        this.formStep = this._formBuilder.group({
            questionnaires: this._formBuilder.array([]),
        });
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    public async ngOnInit() {
        let serializedQuestionnaires = Object.keys(localStorage).filter((key) =>
            key.startsWith("questionnaire-")
        );
        if (serializedQuestionnaires.length > 0) {
            serializedQuestionnaires.forEach((questionnaireKey) => {
                let index = questionnaireKey.split("-")[1];
                let item = this.localStorageService.getItem(
                    `questionnaire-${index}`
                );
                this.dataStored.push(
                    new Questionnaire(parseInt(index), JSON.parse(item))
                );
            });
            this.dataStored.sort((a, b) => (a.index > b.index ? 1 : -1));
        } else {
            this.initializeControls();
            let rawQuestionnaires = await this.S3Service.downloadQuestionnaires(
                this.configService.environment
            );
            rawQuestionnaires.forEach((data, index) => {
                let questionnaire = new Questionnaire(index, data);
                this.dataStored.push(questionnaire.serializable());
                this.localStorageService.setItem(
                    `questionnaire-${index}`,
                    JSON.stringify(questionnaire.serializable())
                );
            });
        }
        if (this.dataStored.length > 0) {
            this.dataStored.forEach((questionnaire, questionnaireIndex) => {
                this.addQuestionnaire(questionnaireIndex, questionnaire);
            });
        }
        this.formStep.valueChanges.subscribe((_form) => {
            this.serializeConfiguration();
        });
        this.serializeConfiguration();
        this.formEmitter.emit(this.formStep);
    }

    /* STEP #1 - Questionnaires */

    questionnaires(): UntypedFormArray {
        return this.formStep?.get("questionnaires") as UntypedFormArray;
    }

    addQuestionnaire(
        questionnaireIndex = null,
        questionnaire = null as Questionnaire
    ) {
        this.questionnaires().push(
            this._formBuilder.group({
                type: [
                    questionnaire
                        ? questionnaire.type
                            ? questionnaire.type
                            : ""
                        : "",
                    [Validators.required],
                ],
                description: questionnaire
                    ? questionnaire.description
                        ? questionnaire.description
                        : ""
                    : "",
                position: questionnaire
                    ? questionnaire.position
                        ? questionnaire.position
                        : ""
                    : "",
                allow_back: questionnaire
                    ? questionnaire.allow_back
                        ? questionnaire.allow_back
                        : false
                    : false,
                questions: this._formBuilder.array([]),
                mapping: this._formBuilder.array([]),
            })
        );
        if (questionnaire) {
            questionnaire.questions.forEach((question, questionIndex) =>
                this.addQuestion(questionnaireIndex, questionIndex, question)
            );
        }
    }

    removeQuestionnaire(questionnaireIndex: number) {
        this.questionnaires().removeAt(questionnaireIndex);
    }

    updateQuestionnaire(questionnaireIndex) {
        let questionnaire = this.questionnaires()?.at(questionnaireIndex);

        this.questions(questionnaireIndex).clear();
        this.mapping(questionnaireIndex).clear();

        this.addQuestion(questionnaireIndex);
        if (questionnaire?.get("type").value == "likert") {
            this.addMapping(questionnaireIndex);
        }
    }

    /* SUB ELEMENT: Questions */

    questions(questionnaireIndex: number): UntypedFormArray {
        return this.questionnaires()?.at(questionnaireIndex)?.get("questions") as UntypedFormArray;
    }

    addQuestion(
        questionnaireIndex: number,
        questionIndex = null as number,
        question = null as Question
    ) {
        this.questions(questionnaireIndex).push(
            this._formBuilder.group({
                index: question
                    ? question.index
                        ? question.index
                        : questionIndex
                    : questionIndex,
                name: [
                    question ? (question.name ? question.name : "") : "",
                    [Validators.required],
                ],
                text: [
                    question ? (question.text ? question.text : "") : "",
                    [Validators.required],
                ],
                answers: this._formBuilder.array([]),
            })
        );
        if (question && question.answers)
            for (let answer of question.answers)
                this.addAnswer(questionnaireIndex, questionIndex, answer);
        if (
            this.questionnaires()?.at(questionnaireIndex)?.get("type").value ==
                "standard" &&
            this.questions(questionnaireIndex).length == 0
        ) {
            this.addAnswer(
                questionnaireIndex,
                this.questions(questionnaireIndex).length - 1
            );
        }
    }

    removeQuestion(questionnaireIndex: number, questionIndex: number) {
        this.questions(questionnaireIndex).removeAt(questionIndex);
    }

    /* SUB ELEMENT: Answers */

    answers(
        questionnaireIndex: number,
        questionIndex: number
    ): UntypedFormArray {
        return this.questions(questionnaireIndex)?.at(questionIndex)?.get("answers") as UntypedFormArray;
    }

    addAnswer(
        questionnaireIndex: number,
        questionIndex: number,
        answer = null as string
    ) {
        this.answers(questionnaireIndex, questionIndex).push(
            this._formBuilder.group({
                answer: [answer ? answer : "", [Validators.required]],
            })
        );
    }

    removeAnswer(
        questionnaireIndex: number,
        questionIndex: number,
        answerIndex: number
    ) {
        this.answers(questionnaireIndex, questionIndex).removeAt(answerIndex);
    }

    /* SUB ELEMENT: Mappings  */

    mapping(questionnaireIndex: number): UntypedFormArray {
        return this.questionnaires()?.at(questionnaireIndex)?.get("mapping") as UntypedFormArray;
    }

    addMapping(questionnaireIndex: number) {
        this.mapping(questionnaireIndex).push(
            this._formBuilder.group({
                label: ["", [Validators.required]],
                value: ["", [Validators.required]],
            })
        );
    }

    removeMapping(questionnaireIndex: number, mappingIndex: number) {
        this.mapping(questionnaireIndex).removeAt(mappingIndex);
    }

    /* JSON Output */

    serializeConfiguration() {
        let serializedQuestionnaires = Object.keys(localStorage).filter((key) =>
            key.startsWith("questionnaire-")
        );
        if (serializedQuestionnaires.length > 0)
            serializedQuestionnaires.forEach((questionnaireKey) =>
                this.localStorageService.removeItem(questionnaireKey)
            );
        let questionnairesJSON = JSON?.parse(
            JSON?.stringify(this.formStep?.get("questionnaires").value)
        );
        questionnairesJSON.forEach((questionnaire, questionnaireIndex) => {
            switch (questionnaire.type) {
                case "crt":
                    delete questionnaire.description;
                    for (let questionIndex in questionnaire.questions) {
                        questionnaire.questions[questionIndex]["type"] =
                            "number";
                        questionnaire.questions[questionIndex]["required"] =
                            true;
                        delete questionnaire.questions[questionIndex].answers;
                    }
                    delete questionnaire.mapping;
                    break;

                case "likert":
                    for (let questionIndex in questionnaire.questions) {
                        delete questionnaire.questions[questionIndex].answers;
                        questionnaire.questions[questionIndex]["type"] = "mcq";
                        questionnaire.questions[questionIndex]["required"] =
                            true;
                        questionnaire.questions[questionIndex]["free_text"] =
                            false;
                        questionnaire.questions[questionIndex]["detail"] = null;
                        questionnaire.questions[questionIndex]["show_detail"] =
                            false;
                    }
                    break;

                case "standard":
                    delete questionnaire.description;
                    for (let questionIndex in questionnaire.questions) {
                        let answersStringArray = [];
                        for (let answerIndex in questionnaire.questions[
                            questionIndex
                        ].answers) {
                            answersStringArray.push(
                                questionnaire.questions[questionIndex].answers[
                                    answerIndex
                                ].answer
                            );
                        }
                        questionnaire.questions[questionIndex].answers =
                            answersStringArray;
                        questionnaire.questions[questionIndex]["type"] = "mcq";
                        questionnaire.questions[questionIndex]["required"] =
                            true;
                        questionnaire.questions[questionIndex]["free_text"] =
                            false;
                        questionnaire.questions[questionIndex]["detail"] = null;
                        questionnaire.questions[questionIndex]["show_detail"] =
                            false;
                    }
                    delete questionnaire.mapping;
                    break;
                default:
                    break;
            }
            this.localStorageService.setItem(
                `questionnaire-${questionnaireIndex}`,
                JSON.stringify(questionnaire)
            );
        });
        this.configurationSerialized = JSON.stringify(questionnairesJSON);
    }
}
