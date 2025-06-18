/* -------------------------------------------------------------------- */
/* Questionnaire model – helper-based tree, no CommonJS                 */
/* -------------------------------------------------------------------- */

import {Question} from './question';
import {
    TreeNode,
    walk,
    first,
    drop
} from 'src/app/shared/utils/tree-utils.helper';

/* Minimal description of node.model (add extra fields as needed) */
interface QNodeModel {
    index?: number;
    indexFull?: string | any[];
    name?: string;
    nameFull?: string;
    text?: string;
    repeat?: boolean;
    target?: string;
    answers?: Record<string, string> | string[];
    position?: any;
    questions?: TreeNode<QNodeModel>[];
}

/* -------------------------------------------------------------------- */
/* Main class                                                           */

/* -------------------------------------------------------------------- */
export class Questionnaire {

    /* Public metadata ----------------------------- */
    index: number;
    name: string;
    name_pretty: string;
    type: string;
    description?: string;
    caption?: string;
    allow_back?: boolean;
    position?: string;

    /* Collections -------------------------------- */
    mappings: Mapping[] = [];
    questions: Question[] = [];

    /* Tree roots --------------------------------- */
    treeOriginal!: TreeNode<QNodeModel>;
    treeCut!: TreeNode<QNodeModel>;

    /* Runtime helpers ---------------------------- */
    lastQuestionIndex = 0;
    questionsToRepeat: Question[] = [];
    questionDependencies: Record<string, boolean> = {};

    /* ------------------------------------------------------------------ */
    /* Constructor                                                        */

    /* ------------------------------------------------------------------ */
    constructor(index: number, raw: any) {

        /* Copy simple scalars from raw root ------------------------------ */
        this.index = index;
        this.name = raw.name ?? null;
        this.name_pretty = raw.name_pretty ?? null;
        this.description = raw.description ?? null;
        this.caption = raw.caption ?? null;
        this.position = raw.position ?? null;
        this.allow_back = raw.allow_back ?? false;
        this.type = raw.type;

        /* Helper: convert a plain object (or tree) to TreeNode shape ----- */
        const toNode = (obj: any): TreeNode<QNodeModel> => {
            const {questions, children, ...rest} = obj;      // detach children
            const node: TreeNode<QNodeModel> = {model: {...rest}};

            const kids = questions ?? children;
            if (Array.isArray(kids) && kids.length) {
                node.questions = kids.map((k: any) => toNode(k));
            }
            return node;
        };

        /* Build mutable treeCut and pristine treeOriginal ---------------- */
        this.treeCut = toNode(raw);
        this.treeOriginal = JSON.parse(JSON.stringify(this.treeCut));

        /* First enrichment pass: add indexFull / nameFull, collect repeats */
        const nodesToDrop: string[] = [];

        walk(
            this.treeCut,
            (node: TreeNode<QNodeModel>) => {
                if (node === this.treeCut) return;   // skip root

                if (!node.model.nameFull) {
                    node.model.indexFull = `${Number(node.model.index) + 1}`;
                    node.model.nameFull = node.model.name;
                }

                if (node.questions?.length) {
                    node.questions.forEach(child => {
                        child.model.indexFull = `${node.model.indexFull}.${child.model.index! + 1}`;
                        child.model.nameFull = `${node.model.nameFull}_${child.model.name}`;
                        if (node.model.repeat) nodesToDrop.push(child.model.nameFull!);
                    });
                }
            }
        );

        /* Second pass: create Question objects --------------------------- */
        walk(
            this.treeCut,
            (node: TreeNode<QNodeModel>) => {
                if (node === this.treeCut) return;

                const rawIdx = node.model.indexFull;
                const idxStr = Array.isArray(rawIdx) ? rawIdx.join('.') : rawIdx;

                const q = new Question(this.lastQuestionIndex, node.model as any);
                q.indexFull = idxStr;
                q.nameFull = node.model.nameFull;
                q.dropped = true;

                this.lastQuestionIndex++;
                this.questions.push(q);
            }
        );

        /* Drop repeat branches ------------------------------------------- */
        for (const nf of nodesToDrop) {
            const n = first(this.treeCut, node => node.model.nameFull === nf);
            if (n) drop(this.treeCut, n);
        }

        /* Third pass: mark surviving questions as not dropped ------------ */
        walk(
            this.treeCut,
            (node: TreeNode<QNodeModel>) => {
                if (node === this.treeCut) return;
                const match = this.questions.find(q => q.nameFull === node.model.nameFull);
                if (match) match.dropped = false;
            }
        );

        /* Optional mappings array ---------------------------------------- */
        if (raw.mapping) {
            raw.mapping.forEach((m: any, i: number) => this.mappings.push(new Mapping(i, m)));
        }
    }

    /* ------------------------------------------------------------------ */
    /* Utility: strip heavy fields when serialising                       */

    /* ------------------------------------------------------------------ */
    serializable(): Questionnaire {
        const copy: any = {...this};
        delete copy.treeOriginal;
        delete copy.treeCut;
        delete copy.lastQuestionIndex;
        delete copy.questionsToRepeat;
        delete copy.questionDependencies;
        return copy as Questionnaire;
    }
}

/* -------------------------------------------------------------------- */
/* Mapping sub-class (unchanged)                                        */
/* -------------------------------------------------------------------- */
export class Mapping {
    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number;

    label: string;
    key: string;
    value: string;
    spacing: string;

    constructor(index: number, data: any) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index;

        this.label = data.label;
        this.key = data.key;
        this.value = data.value;
        this.spacing = data.spacing;
    }
}
