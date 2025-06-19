export class Question {
    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number;
    indexFull: string;

    name: string;
    type: string;
    repeat?: boolean;
    times?: number;
    dependant?: boolean;
    needed?: string;
    target?: string;
    nameFull?: string;
    required?: boolean;
    text?: string;
    detail?: Detail;
    showDetail?: boolean;
    freeText?: boolean;
    answers?: string[];
    showIndex?: boolean;

    dropped = false;

    constructor(index: number, data: any) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index;
        this.indexFull = `${index + 1}`;

        this.name = data['name'];
        this.type = data['type'];
        this.nameFull = data['nameFull'] ?? null;
        this.text = data['text'] ?? null;
        this.dependant = data['dependant'] ?? null;
        this.repeat = data['repeat'] ?? null;
        this.needed = data['needed'] ?? null;
        this.target = data['target'] ?? null;
        this.times = data['times'] ? parseInt(data['times'], 10) : null;
        this.required = data['required'];

        if (data['answers']) {
            this.answers = [...data['answers']];   // plain strings
        }

        this.detail = data['detail'] ? new Detail(data['detail']) : null;
        this.showDetail = data['show_detail'] ?? null;
        this.freeText = data['free_text'] ?? null;
        this.showIndex = data['show_index'] ?? true;
    }
}

export class Detail {
    text: string;
    elements: Element[];

    constructor(data: any) {
        this.text = data['text'];
        this.elements = data['elements'].map((el: any, idx: number) => new Element(idx, el));
    }
}

export class Element {
    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number;

    key: string;
    items: string[];

    constructor(index: number, data: any) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index;

        this.key = data['key'];
        this.items = [...data['items']];
    }
}
