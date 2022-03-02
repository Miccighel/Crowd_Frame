import * as TreeModel from 'tree-model';

export class Questionnaire {

    index: number;

    type: string;
    description?: string;
    allow_back?: boolean;
    position?: string;
    questions: Array<Question>;
    mappings: Array<Mapping>;
    root : TreeModel.Node<JSON>

    questionsDropped = [];

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
        let treeModel = new TreeModel({"childrenPropertyName": 'questions'})
        this.root = treeModel.parse(data)
        let nodesToDrop = []
        this.root.walk(function (node) {
            if (node) {
                if (!node.isRoot()) {
                    if (!node.model.nameFull) {
                        node.model.indexFull = `${(node.model.index + 1)}`
                        node.model.nameFull = node.model.name
                    }
                    if (node.hasChildren()) {
                        for (let child of node.children) {
                            child.model.indexFull = `${node.model.indexFull}.${(child.model.index + 1)}`
                            child.model.nameFull = `${node.model.nameFull}_${child.model.name}`
                            if (node.model.repeat) {
                                nodesToDrop.push(child.model.nameFull)
                            }
                        }
                    }
                    /* Additional operations on node if needed */
                }
            } else {
                return false
            }
        });
        for (let nodeToDrop of nodesToDrop) {
            let node = this.root.first(function (node) {
                return node.model.nameFull === nodeToDrop;
            });
            this.questionsDropped.push(node.model)
            node.drop()
        }
        this.questions = this.root.model
        if (data['mapping']) {
            this.mappings = new Array<Mapping>();
            for (let index = 0; index < data["mapping"].length; index++) this.mappings.push(new Mapping(index, data["mapping"][index]))
        }
    }

}

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

    constructor(
        index: number,
        data: JSON
    ) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index
        this.name = data["name"]
        this.type = data['type']
        this.nameFull = data['nameFull'] ? data["nameFull"] : null
        this.text = data['text'] ? data["text"] : null
        this.repeat = data['repeat'] ? data["repeat"] : null
        this.target = data['target'] ? data["target"] : null
        this.times = data['times'] ? parseInt(data["times"]) : null
        this.required = data['required']
        if (data['answers']) {
            this.answers = new Array<string>();
            for (const [_, answer] of data["answers"].entries()) this.answers.push(answer)
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