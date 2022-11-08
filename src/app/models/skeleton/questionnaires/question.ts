export class Question {

    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number
    indexFull: string

    name: string
    type: string
    repeat?: boolean
    times?: number
    dependant?: boolean
    needed?: string
    target?: string
    nameFull?: string
    required?: boolean
    text?: string
    detail?: Detail
    showDetail?: boolean
    freeText?: boolean
    answers?: Array<string>

    dropped = false

    constructor(
        index: number,
        data: JSON
    ) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index
        this.indexFull = `${(index + 1)}`
        this.name = data["name"]
        this.type = data['type']
        this.nameFull = data['nameFull'] ? data["nameFull"] : null
        this.text = data['text'] ? data["text"] : null
        this.dependant = data['dependant'] ? data["dependant"] : null
        this.repeat = data['repeat'] ? data["repeat"] : null
        this.needed = data['needed'] ? data["needed"] : null
        this.target = data['target'] ? data["target"] : null
        this.times = data['times'] ? parseInt(data["times"]) : null
        this.required = data['required']
        if (data['answers']) {
            this.answers = new Array<string>();
            for (const [_, answer] of data["answers"].entries()) this.answers.push(answer)
        }
        this.detail = data['detail'] ? new Detail(data["detail"]) : null;
        this.showDetail = data['show_detail'] ? data['show_detail'] : null;
        this.freeText = data['free_text'] ? data['free_text'] : null;
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

