// questionnaire.ts

import {Question} from './question';

export interface QNode {
    index?: number;
    indexFull?: string;
    name?: string;
    nameFull?: string;
    text?: string;
    type?: string;
    required?: boolean;
    repeat?: boolean;
    times?: number;
    target?: string;
    dependant?: boolean;
    needed?: string;
    answers?: Record<string, string> | string[];
    position?: any;
    questions?: QNode[];
}

export function walkNode(node: QNode, fn: (n: QNode) => void): void {
    fn(node);
    node.questions?.forEach(c => walkNode(c, fn));
}

export function firstNode(
    node: QNode,
    pred: (n: QNode) => boolean
): QNode | null {
    if (pred(node)) return node;
    for (const c of node.questions ?? []) {
        const res = firstNode(c, pred);
        if (res) return res;
    }
    return null;
}

export function allNodes(node: QNode, pred: (n: QNode) => boolean): QNode[] {
    const acc: QNode[] = [];
    walkNode(node, n => {
        if (pred(n)) acc.push(n);
    });
    return acc;
}

export function addChildNode(parent: QNode, child: QNode): void {
    if (!parent.questions) parent.questions = [];
    parent.questions.push(child);
}

export function dropNode(root: QNode, victim: QNode): void {
    if (!root.questions?.length) return;
    root.questions = root.questions.filter(c => c !== victim);
    root.questions.forEach(c => dropNode(c, victim));
}

export class Mapping {
    index: number;
    label: string;
    key: string;
    value: string;
    spacing: string;

    constructor(index: number, data: any) {
        this.index = index;
        this.label = data.label;
        this.key = data.key;
        this.value = data.value;
        this.spacing = data.spacing;
    }
}

export class Questionnaire {
    index: number;
    name: string | null;
    name_pretty: string | null;
    type: string;
    description?: string | null;
    caption?: string | null;
    position?: string | null;
    allow_back: boolean;
    mappings: Mapping[] = [];
    questions: Question[] = [];
    treeOriginal!: QNode;
    treeCut!: QNode;
    lastQuestionIndex = 0;
    questionsToRepeat: Question[] = [];
    questionDependencies: Record<string, boolean> = {};

    constructor(index: number, raw: any) {
        this.index = index;
        this.name = raw.name ?? null;
        this.name_pretty = raw.name_pretty ?? null;
        this.description = raw.description ?? null;
        this.caption = raw.caption ?? null;
        this.position = raw.position ?? null;
        this.allow_back = raw.allow_back ?? false;
        this.type = raw.type;

        const clone = (o: any): QNode => {
            const kids = (o.questions ?? o.children) as any[] | undefined;
            const node: QNode = {...o};
            delete (node as any).children;
            if (kids?.length) node.questions = kids.map(clone);
            return node;
        };
        this.treeCut = clone(raw);
        this.treeOriginal = JSON.parse(JSON.stringify(this.treeCut));

        const nodesToDrop: string[] = [];

        // First pass: indexFull and nameFull assignment
        walkNode(this.treeCut, node => {
            if (node === this.treeCut) return;
            if (!node.nameFull) {
                node.indexFull = `${Number(node.index) + 1}`;
                node.nameFull = node.name;
            }
            node.questions?.forEach(child => {
                child.indexFull = `${node.indexFull}.${(child.index ?? 0) + 1}`;
                child.nameFull = `${node.nameFull}_${child.name}`;
                if (node.repeat) nodesToDrop.push(child.nameFull!);
            });
        });

        // Second pass: Create Question objects
        walkNode(this.treeCut, node => {
            if (node === this.treeCut) return;
            const rawIdx = node.indexFull;
            if (rawIdx === undefined) return;
            const q = new Question(this.lastQuestionIndex, node as any);
            q.indexFull = rawIdx;
            q.nameFull = node.nameFull;
            q.dropped = true;
            this.lastQuestionIndex++;
            this.questions.push(q);
        });

        // Remove repeat placeholder nodes
        nodesToDrop.forEach(nf => {
            const vic = firstNode(this.treeCut, n => n.nameFull === nf);
            if (vic) dropNode(this.treeCut, vic);
        });

        // Mark non-dropped questions
        walkNode(this.treeCut, node => {
            const hit = this.questions.find(q => q.nameFull === node.nameFull);
            if (hit) hit.dropped = false;
        });

        // Optional mappings
        raw.mapping?.forEach((m: any, i: number) => this.mappings.push(new Mapping(i, m)));
    }

    /**
     * Recursively update indexFull and nameFull for a QNode subtree.
     * Ensures dot-separated string for indexFull at all times.
     */
    public updateIndicesForRepeat(
        node: QNode,
        parentIndexFull: string | undefined,
        parentNameFull: string | undefined,
        repeatIndex: number
    ): void {
        const parentIdxArr = parentIndexFull
            ? parentIndexFull.split('.')
            : [];
        node.indexFull = parentIdxArr.length
            ? parentIdxArr.concat([String(repeatIndex + 1)]).join('.')
            : String(repeatIndex + 1);

        node.nameFull = parentNameFull
            ? `${parentNameFull}_${node.name}_${repeatIndex}`
            : `${node.name}_${repeatIndex}`;
        if (node.questions && node.questions.length) {
            node.questions.forEach((child, idx) =>
                this.updateIndicesForRepeat(child, node.indexFull, node.nameFull, idx)
            );
        }
    }

    /**
     * Recursively register all Questions from a (newly cloned) QNode subtree.
     */
    public registerQuestionsFromNode(node: QNode): void {
        const q = new Question(this.lastQuestionIndex, node as any);
        q.indexFull = node.indexFull;
        q.nameFull = node.nameFull;
        q.dropped = false;
        this.lastQuestionIndex++;
        this.questions.push(q);
        if (node.questions) node.questions.forEach(child =>
            this.registerQuestionsFromNode(child)
        );
    }

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
