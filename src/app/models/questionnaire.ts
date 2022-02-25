import {FormControl, Validators} from "@angular/forms";

export class Questionnaire {

    index: number;

    type: string;
    description?: string;
    allow_back?: boolean;
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
        this.allow_back = data['allow_back'] ? data["allow_back"] : false;
        this.type = data["type"];
        this.questions = new Array<Question>();
        this.questions = data['questions'] ? data['questions'].map((item, index) => new Question(index, item)) : [];
        if (data['mapping']) {
            this.mappings = new Array<Mapping>();
            for (let index = 0; index < data["mapping"].length; index++) this.mappings.push(new Mapping(index, data["mapping"][index]))
        }
    }

}

export class Question {

    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number

    name: string
    type: string
    repeat?: boolean
    times?: number
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
        this.nameFull = null
        this.text = data['text'] ? data["text"] : null
        this.repeat = data['repeat'] ? data["repeat"] : null
        this.times = data['times'] ? parseInt(data["times"]) : null
        this.required = data['required']
        if (data['answers']) {
            this.answers = new Array<string>();
            for (const [_, answer] of data["answers"].entries()) this.answers.push(answer)
        }
        if (data['questions']) {
            this.questions = new Array<Question>();
            this.questions.push(new Question(index, data["questions"][index]))
        }
        this.detail = data['detail'] ? new Detail(data["detail"]) : null;
        this.showDetail = data['show_detail'] ? data['show_detail'] : false;
        this.freeText = data['free_text'] ? data['free_text'] : false;
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
    key: string;
    value: string;

    constructor(
        index: number,
        data: JSON
    ) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index;

        this.label = data["label"];
        this.key = data["key"];
        this.value = data["value"];
    }

}
