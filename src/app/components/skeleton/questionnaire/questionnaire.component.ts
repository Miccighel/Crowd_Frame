/* -------------------------------------------------------------------- */
/* questionnaire.component.ts                                           */
/* -------------------------------------------------------------------- */

import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output
} from '@angular/core';
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators
} from '@angular/forms';

import {SectionService} from '../../../services/section.service';
import {UtilsService} from '../../../services/utils.service';

import {Questionnaire} from '../../../models/skeleton/questionnaires/questionnaire';
import {Task} from '../../../models/skeleton/task';
import {Worker} from '../../../models/worker/worker';
import {Question} from '../../../models/skeleton/questionnaires/question';
import {DataRecord} from '../../../models/skeleton/dataRecord';

import {MatStepper} from '@angular/material/stepper';

import {
    TreeNode,
    walk,
    first,
    all,
    addChild,
    drop
} from 'src/app/shared/utils/tree-utils.helper';

interface QModel {
    index?: number;
    indexFull?: any;
    name?: string;
    nameFull?: string;
    text?: string;
    repeat?: boolean;
    target?: string;
    answers?: Record<string, string>;
    position?: any;
    questions?: TreeNode<QModel>[];
}

@Component({
    selector: 'app-questionnaire',
    templateUrl: './questionnaire.component.html',
    styleUrls: ['./questionnaire.component.scss']
})
export class QuestionnaireComponent implements OnInit {

    @Input() questionnaireIndex!: number;
    @Input() questionnairesForm!: UntypedFormGroup[];
    @Input() stepper!: MatStepper;
    @Input() worker!: Worker;

    @Output() formEmitter = new EventEmitter<{
        form: UntypedFormGroup;
        action: 'Back' | 'Next' | 'Finish' | null;
    }>();

    questionnaireForm!: UntypedFormGroup;
    questionnaire    !: Questionnaire;
    task             !: Task;
    mostRecentDataRecord: DataRecord | null = null;
    nodes: TreeNode<QModel>[] = [];

    constructor(
        private cdr: ChangeDetectorRef,
        public sectionService: SectionService,
        private util: UtilsService,
        private fb: UntypedFormBuilder
    ) {
        this.task = this.sectionService.task;
    }

    /* ------------------------------------------------------------------ */
    /* Lifecycle                                                          */

    /* ------------------------------------------------------------------ */

    ngOnInit(): void {
        this.questionnaire = this.task.questionnaires[this.questionnaireIndex];
        this.stepper.selectedIndex = this.worker.getPositionCurrent();
        this.sectionService.stepIndex = this.worker.getPositionCurrent();
        this.mostRecentDataRecord =
            this.task.retrieveMostRecentDataRecord('questionnaire',
                this.questionnaireIndex) ?? null;

        if (this.questionnairesForm[this.questionnaireIndex]) {
            this.questionnaireForm = this.questionnairesForm[this.questionnaireIndex];
        } else {
            this.questionnaireForm = this.fb.group({});

            walk(
                this.questionnaire.treeCut as TreeNode<QModel>,
                (node: TreeNode<QModel>) => {
                    if (node === this.questionnaire.treeCut) return;
                    if (!('position' in node.model)) {
                        if (node.questions?.length) {
                            for (const child of node.questions) {
                                this.nodes.push(child);
                                if (child.model.repeat) return false;
                            }
                        } else {
                            this.nodes.push(node);
                            if (node.model.repeat) return false;
                        }
                    }
                },
                this
            );

            for (const n of this.nodes) {
                for (const q of this.questionnaire.questions) {
                    if (n.model.nameFull === q.nameFull && !q.dropped) {
                        this.initControl(q);
                    }
                }
            }
        }

        this.formEmitter.emit({form: this.questionnaireForm, action: null});
    }

    /* ------------------------------------------------------------------ */
    /* Control initialisation                                             */

    /* ------------------------------------------------------------------ */

    private initControl(q: Question): void {
        if (q.type === 'section' || q.dependant) return;

        const name = q.nameFull;
        const validators: any[] = [];

        if (q.required) validators.push(Validators.required);
        if (q.type === 'number')
            validators.push(Validators.min(0), Validators.max(100));
        if (q.type === 'email') validators.push(Validators.email);
        if (q.repeat) {
            validators.push(Validators.min(0), Validators.max(q.times));
            if (!this.questionnaire.questionsToRepeat.includes(q))
                this.questionnaire.questionsToRepeat.push(q);
        }

        const prevAns = this.mostRecentDataRecord?.loadAnswers() ?? {};
        const prevVal = prevAns[`${name}_answer`] ?? '';

        if (q.type === 'list') {
            const answers: Record<number, boolean> = {};
            q.answers.forEach((_v, idx) => (answers[idx] = false));
            this.questionnaireForm.addControl(`${name}_list`, this.fb.group(answers));
            this.questionnaireForm.addControl(
                `${name}_answer`,
                new UntypedFormControl(prevVal, [Validators.required])
            );
        } else {
            this.questionnaireForm.addControl(
                `${name}_answer`,
                new UntypedFormControl(prevVal, validators)
            );
        }

        if (q.freeText) {
            const prevFree = prevAns[`${name}_free_text`] ?? '';
            this.questionnaireForm.addControl(
                `${name}_free_text`,
                new UntypedFormControl(prevFree)
            );
        }
    }

    /* ------------------------------------------------------------------ */
    /* Dependency handling                                                */

    /* ------------------------------------------------------------------ */

    public handleQuestionDependency(q: Question): boolean {
        if (!q.dependant) return true;

        this.questionnaire.questionDependencies[q.nameFull] = false;

        walk(
            this.questionnaire.treeCut as TreeNode<QModel>,
            (node: TreeNode<QModel>) => {
                if (node === this.questionnaire.treeCut) return;

                if (node.model.name === q.target &&
                    q.indexFull.includes(node.model.indexFull)) {

                    const value = this.questionnaireForm
                        .get(`${node.model.nameFull}_answer`)?.value ?? '';

                    if (value !== '') {
                        const label = node.model.answers?.[value];
                        if (label === q.needed) {
                            this.enableDependant(q);
                            this.questionnaire.questionDependencies[q.nameFull] = true;
                        }
                    } else {
                        this.questionnaireForm
                            .get(`${q.nameFull}_answer`)?.clearValidators();
                        this.questionnaire.questionDependencies[q.nameFull] = false;
                    }
                }
            },
            this
        );

        Object.entries(this.questionnaire.questionDependencies).forEach(
            ([nf, ok]) => {
                if (!ok) {
                    const ctrl = this.questionnaireForm.get(`${nf}_answer`);
                    ctrl?.clearValidators();
                    ctrl?.setErrors(null);
                    ctrl?.setValue('');
                }
            }
        );

        return this.questionnaire.questionDependencies[q.nameFull];
    }

    private enableDependant(q: Question): void {
        const name = q.nameFull;
        const validators: any[] = [];

        if (q.required) validators.push(Validators.required);
        if (q.type === 'number')
            validators.push(Validators.min(0), Validators.max(100));
        if (q.type === 'email') validators.push(Validators.email);
        if (q.repeat) {
            validators.push(Validators.min(0), Validators.max(q.times));
            if (!this.questionnaire.questionsToRepeat.includes(q))
                this.questionnaire.questionsToRepeat.push(q);
        }

        const prev = this.mostRecentDataRecord?.loadAnswers() ?? {};
        const prevVal = prev[`${name}_answer`] ?? '';

        if (q.type === 'list') {
            const answers: Record<number, boolean> = {};
            q.answers.forEach((_v, idx) => (answers[idx] = false));
            this.questionnaireForm.addControl(`${name}_list`, this.fb.group(answers));
            this.questionnaireForm.addControl(
                `${name}_answer`,
                new UntypedFormControl(prevVal, [Validators.required])
            );
        } else {
            this.questionnaireForm.addControl(
                `${name}_answer`,
                new UntypedFormControl(prevVal, validators)
            );
        }

        if (q.freeText) {
            const prevFree = prev[`${name}_free_text`] ?? '';
            this.questionnaireForm.addControl(
                `${name}_free_text`,
                new UntypedFormControl(prevFree)
            );
        }
    }

    /* ------------------------------------------------------------------ */
    /* Checkbox handler                                                   */

    /* ------------------------------------------------------------------ */

    public handleCheckbox(q: Question, groupName: string): void {
        let anyChecked = false;
        const grp = this.questionnaireForm.get(groupName);
        const ctrl = this.questionnaireForm.get(`${q.nameFull}_answer`);

        Object.values(grp?.value ?? {}).forEach(v => (anyChecked ||= !!v));
        ctrl?.setValue(anyChecked ? grp?.value : '');
        ctrl?.markAsTouched();
    }

    /* ------------------------------------------------------------------ */
    /* Question repetition                                                */

    /* ------------------------------------------------------------------ */

    public handleQuestionRepetition(q: Question): void {
        const ctrl = this.questionnaireForm.get(`${q.nameFull}_answer`);
        if (!ctrl) return;

        for (const repQ of this.questionnaire.questionsToRepeat) {
            const updatedVal = ctrl.value;
            for (const cur of this.questionnaire.questions) {
                if (cur.target !== repQ.name) continue;
                if (updatedVal > repQ.times) continue;

                const targetNode = first(
                    this.questionnaire.treeOriginal as TreeNode<QModel>,
                    n => n.model.target === repQ.name
                );
                const childNodes = all(
                    this.questionnaire.treeCut as TreeNode<QModel>,
                    n => n.model.target === repQ.name
                );
                const parentNode = first(
                    this.questionnaire.treeCut as TreeNode<QModel>,
                    n => n.model.name === repQ.name
                );

                if (!targetNode || !parentNode) continue;

                /* --------------------------------- ADD branches */
                if (updatedVal >= childNodes.length) {
                    for (let i = childNodes.length; i < updatedVal; i++) {

                        const idxUpd = targetNode.model.indexFull.slice(0, -1).concat(i + 1);

                        walk(
                            targetNode,
                            (node: TreeNode<QModel>) => {
                                if (node.model.target === repQ.name) {
                                    if (node.model.text?.includes(' nr. ')) {
                                        node.model.text =
                                            node.model.text.slice(0, -5).concat(' nr. ', `${i + 1}`);
                                    } else {
                                        node.model.text =
                                            (node.model.text ?? '') + ' nr. ' + (i + 1).toString();
                                    }
                                }

                                const idxSlice = node.model.indexFull.slice(idxUpd.length);
                                const idxFullArr = idxUpd.concat(idxSlice);

                                const newQ = new Question(
                                    this.questionnaire.lastQuestionIndex,
                                    node.model as any
                                );
                                newQ.indexFull = idxFullArr.join('.');   // <-- string now
                                newQ.index = this.questionnaire.lastQuestionIndex;

                                const suffixExists = new Array(repQ.times + 1)
                                    .some(j => newQ.nameFull.includes(`_${j}`));

                                newQ.nameFull = suffixExists
                                    ? newQ.nameFull.slice(0, -2).concat('_', i.toString())
                                    : newQ.nameFull.concat('_', i.toString());

                                node.model.index = this.questionnaire.lastQuestionIndex;
                                node.model.indexFull = idxFullArr;
                                node.model.nameFull = newQ.nameFull;

                                this.questionnaire.lastQuestionIndex++;
                                this.questionnaire.questions.push(newQ);
                            },
                            this
                        );

                        addChild(parentNode, targetNode);
                        for (const qst of this.questionnaire.questions) {
                            if (!qst.dropped) this.initControl(qst);
                        }
                        this.cdr.detectChanges();
                    }
                }
                /* --------------------------------- DROP branches */
                else {
                    const toDrop = childNodes.at(-1);
                    if (!toDrop) continue;

                    drop(this.questionnaire.treeCut as TreeNode<QModel>, toDrop);

                    const removeQs: Question[] = [];
                    walk(
                        toDrop,
                        (node: TreeNode<QModel>) => {
                            const match = this.questionnaire.questions.find(
                                qx => qx.index === node.model.index
                            );
                            if (match) removeQs.push(match);
                        },
                        this
                    );

                    for (const rem of removeQs) {
                        this.questionnaireForm.removeControl(`${rem.nameFull}_answer`);
                        this.questionnaireForm.removeControl(`${rem.nameFull}_free_text`);
                        this.questionnaireForm.removeControl(`${rem.nameFull}_list`);
                        delete this.questionnaire.questionDependencies[rem.nameFull];
                        delete (this.questionnaire.questionsToRepeat as any)[rem.nameFull];
                        this.questionnaire.questions =
                            this.questionnaire.questions.filter(qx => qx.index !== rem.index);
                    }
                }
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* Navigation                                                         */

    /* ------------------------------------------------------------------ */

    public handleQuestionnaireCompletion(
        action: 'Back' | 'Next' | 'Finish'
    ): void {
        this.sectionService.stepIndex += action === 'Back' ? -1 : 1;
        this.formEmitter.emit({form: this.questionnaireForm, action});
    }
}
