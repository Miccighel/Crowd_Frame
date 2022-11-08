import * as TreeModel from 'tree-model';
import {Question} from "./question";

export class Questionnaire {

    index: number

    name: string
    type: string
    description?: string
    allow_back?: boolean
    position?: string
    mappings: Array<Mapping>
    questions: Array<Question>

    treeOriginal: TreeModel.Node<JSON>
    treeCut: TreeModel.Node<JSON>
    lastQuestionIndex = 0;
    questionsToRepeat = []
    questionDependencies = {}

    constructor(
        index: number,
        data: JSON
    ) {
        this.index = index;
        this.name = data['name'] ? data["name"] : null;
        this.description = data['description'] ? data["description"] : null;
        this.position = data['position'] ? data["position"] : null;
        this.allow_back = data['allow_back'] ? data["allow_back"] : false;
        this.type = data["type"];
        this.questions = new Array<Question>();
        let treeModel = new TreeModel({"childrenPropertyName": 'questions'})
        this.treeCut = treeModel.parse(data)
        let nodesToDrop = []
        this.treeCut.walk(function (node) {
            if (node) {
                if (!node.isRoot()) {
                    if (!node.model.nameFull) {
                        node.model.indexFull = `${(parseInt(node.model.index) + 1)}`
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
        }, this);
        this.treeOriginal = treeModel.parse(JSON.parse(JSON.stringify(this.treeCut.model)))
        this.treeCut.walk(function (node) {
            if (node) {
                if (!node.isRoot()) {
                    let question = new Question(this['lastQuestionIndex'], node.model)
                    question.indexFull = node.model.indexFull
                    question.nameFull = node.model.nameFull
                    question.dropped = true
                    this['lastQuestionIndex'] = this['lastQuestionIndex'] + 1
                    this['questions'].push(question)
                }
            } else {
                return false
            }
        }, this);
        for (let nodeToDrop of nodesToDrop) {
            let node = this.treeCut.first(function (node) {
                return node.model.nameFull === nodeToDrop;
            });
            node.drop()
        }
        this.treeCut.walk(function (node) {
            if (node) {
                if (!node.isRoot()) {
                    for (let question of this['questions']) {
                        if (node.model.nameFull == question.nameFull) {
                            question.dropped = false
                        }
                    }
                }
            } else {
                return false
            }
        }, this);
        if (data['mapping']) {
            this.mappings = new Array<Mapping>();
            for (let index = 0; index < data["mapping"].length; index++) this.mappings.push(new Mapping(index, data["mapping"][index]))
        }
    }

    serializable() : Questionnaire {
        let questionnaireSerializabile = Object.assign({}, this);
        delete questionnaireSerializabile['treeOriginal']
        delete questionnaireSerializabile['treeCut']
        delete questionnaireSerializabile['lastQuestionIndex']
        delete questionnaireSerializabile['questionsToRepeat']
        delete questionnaireSerializabile['questionDependencies']
        return questionnaireSerializabile
    }

}

export class Mapping {

    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number;

    label: string;
    key: string;
    value: string;
    spacing: string;

    constructor(
        index: number,
        data: JSON
    ) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index;

        this.label = data["label"];
        this.key = data["key"];
        this.value = data["value"];
        this.spacing = data["spacing"];
    }

}