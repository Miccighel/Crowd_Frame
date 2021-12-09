import {FormControl, Validators} from "@angular/forms";

export class Questionnaire {

    index: number;

    type: string;
    description?: string;
    position?: string;
    questions: Array<Question>;
    mappings: Array<Mapping>;

    constructor(
        index: number,
        data: JSON
    ) {

        this.index = index;

        this.description = data['description'] ? data["description"] : null;
        this.position = data['position'] ? data["position"] : null;
        this.type = data["type"];
        this.questions = new Array<Question>();
        for (let index = 0; index < data["questions"].length; index++) this.questions.push(new Question(index, data["questions"][index]))
        if (data['mapping']) {
            this.mappings = new Array<Mapping>();
            for (let index = 0; index < data["mapping"].length; index++) this.mappings.push(new Mapping(index, data["mapping"][index]))
        }

        for (let indexQuestion = 0; indexQuestion < this.questions.length; indexQuestion++) {
            let currentQuestion = this.questions[indexQuestion]
            currentQuestion.nameFull = currentQuestion.name
            if (currentQuestion.questions) {
                for (let indexQuestionSub = 0; indexQuestionSub < currentQuestion.questions.length; indexQuestionSub++) {
                    let currentQuestionSub = currentQuestion.questions[indexQuestionSub]
                    currentQuestionSub.nameFull = `${currentQuestion.nameFull}_${currentQuestionSub.name}`
                    if (currentQuestionSub.questions) {
                        for (let indexQuestionSubSub = 0; indexQuestionSubSub < currentQuestionSub.questions.length; indexQuestionSubSub++) {
                            let currentQuestionSubSub = currentQuestionSub.questions[indexQuestionSubSub]
                            currentQuestionSubSub.nameFull = `${currentQuestionSub.nameFull}_${currentQuestionSubSub.name}`
                            if (currentQuestionSubSub.questions) {
                                for (let indexQuestionSubSubSub = 0; indexQuestionSubSubSub < currentQuestionSubSub.questions.length; indexQuestionSubSubSub++) {
                                    let currentQuestionSubSubSub = currentQuestionSubSub.questions[indexQuestionSubSubSub]
                                    currentQuestionSubSubSub.nameFull = `${currentQuestionSubSub.nameFull}_${currentQuestionSubSubSub.name}`
                                    if (currentQuestionSubSubSub.questions) {
                                        for (let indexQuestionSubSubSubSub = 0; indexQuestionSubSubSubSub < currentQuestionSubSubSub.questions.length; indexQuestionSubSubSubSub++) {
                                            let currentQuestionSubSubSubSub = currentQuestionSubSubSub.questions[indexQuestionSubSubSubSub]
                                            currentQuestionSubSubSubSub.nameFull = `${currentQuestionSubSubSub.nameFull}_${currentQuestionSubSubSubSub.name}`
                                            if (currentQuestionSubSubSubSub.questions) {
                                                for (let indexQuestionSubSubSubSubSub = 0; indexQuestionSubSubSubSubSub < currentQuestionSubSubSubSub.questions.length; indexQuestionSubSubSubSubSub++) {
                                                    let currentQuestionSubSubSubSubSub = currentQuestionSubSubSubSub.questions[indexQuestionSubSubSubSubSub]
                                                    currentQuestionSubSubSubSubSub.nameFull = `${currentQuestionSubSubSubSub.nameFull}_${currentQuestionSubSubSubSubSub.name}`
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

export class Question {

    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number

    name: string
    type: string
    parent?: string
    nameFull?: string
    required?: boolean
    text?: string
    detail?: Detail
    showDetail?: boolean
    freeText?: boolean
    answers?: Array<string>
    questions?: Array<Question>

    constructor(
        index: number,
        data: JSON
    ) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index

        this.name = data["name"]
        this.type = data['type']
        this.parent = data['parent'] ? data["parent"] : null
        this.nameFull = null
        this.text = data['text'] ? data["text"] : null
        this.required = data['required']
        if (data['answers']) {
            this.answers = new Array<string>();
            for (const [_, answer] of data["answers"].entries()) this.answers.push(answer)
        }
        if (data['questions']) {
            this.questions = new Array<Question>();
            for (let index = 0; index < data["questions"].length; index++) this.questions.push(new Question(index, data["questions"][index]))
        }
        this.detail = data['detail'] ? new Detail(data["detail"]) : null;
        this.showDetail = data['show_detail'] ? data['show_detail'] : false;
        this.freeText = data['free_text'] ? data['free_text'] : false;
    }

    public controlName() {
        if (this.parent) {
            return `${this.parent}_${this.name}`
        } else {
            return this.name
        }
    }

}

export class Detail {

    text: string;
    elements: Array<Element>

    constructor(
        data: JSON
    ) {

        this.text = data["text"];
        this.elements = new Array<Element>();
        for (let index = 0; index < data["elements"].length; index++) this.elements.push(new Element(index, data["elements"][index]))

    }

}

export class Element {

    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number;

    key: string;
    items: Array<string>;

    constructor(
        index: number,
        data: JSON
    ) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index;

        this.key = data['key'];
        this.items = new Array<string>();
        for (const [_, item] of data["items"].entries()) this.items.push(item)

    }

}

export class Mapping {

    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number;

    label: string;
    value: string;

    constructor(
        index: number,
        data: JSON
    ) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index;

        this.label = data["label"];
        this.value = data["value"];
    }

}
