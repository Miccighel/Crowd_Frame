// TODO(strict-forms): auto-guarded by codemod – review if needed.
import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators,
} from '@angular/forms';
import {SectionService} from '../../../services/section.service';
import {LocalStorageService} from '../../../services/localStorage.service';

import {
    Questionnaire,
    QNode,
    walkNode,
    firstNode,
    allNodes,
    addChildNode,
    dropNode,
} from '../../../models/skeleton/questionnaires/questionnaire';
import {Question} from '../../../models/skeleton/questionnaires/question';
import {Task} from '../../../models/skeleton/task';
import {Worker} from '../../../models/worker/worker';
import {DataRecord} from '../../../models/skeleton/dataRecord';

import {MatStepper} from '@angular/material/stepper';

@Component({
    selector: 'app-questionnaire',
    templateUrl: './questionnaire.component.html',
    styleUrls: ['./questionnaire.component.scss'],
    standalone: false
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
    questionnaire!: Questionnaire;
    task!: Task;
    mostRecentDataRecord: DataRecord | null = null;
    nodes: QNode[] = [];
    configurationSerialized = '';

    constructor(
        private cdr: ChangeDetectorRef,
        public sectionService: SectionService,
        private fb: UntypedFormBuilder,
        private localStorageService: LocalStorageService,
    ) {
        this.task = this.sectionService.task;
    }

    async ngOnInit(): Promise<void> {
        this.questionnaire = this.task.questionnaires[this.questionnaireIndex];
        this.stepper.selectedIndex = this.worker.getPositionCurrent();
        this.sectionService.stepIndex = this.worker.getPositionCurrent();
        this.mostRecentDataRecord = this.task.retrieveMostRecentDataRecord('questionnaire', this.questionnaireIndex) ?? null;

        const prevAnswers = this.mostRecentDataRecord?.loadAnswers() ?? {};

        if (!this.questionnairesForm[this.questionnaireIndex]) {
            this.questionnaireForm = this.fb.group({});

            // --- ENSURE FULL TREE (INCLUDING REPEATS) IS RESTORED FROM HISTORY ---
            // Loop over all repeatable questions in the questionnaire
            this.questionnaire.questions
                            .filter(q => q.repeat)?.forEach(q => {
                    const repeatCount = Number(prevAnswers[`${q.nameFull}_answer`]);
                    if (repeatCount && repeatCount > 1) {
                        // Add a temp control to allow handleQuestionRepetition to work
                        if (!this.questionnaireForm?.get(`${q.nameFull}_answer`)) {
                            this.questionnaireForm?.addControl(
                                `${q.nameFull}_answer`,
                                new UntypedFormControl(repeatCount)
                            );
                        }
                        // This will expand the tree to match previous repeats
                        this.handleQuestionRepetition(q);
                    }
                });

            // Now collect all nodes for control initialization
            this.nodes = [];
            walkNode(this.questionnaire.treeCut, n => {
                if (n === this.questionnaire.treeCut) return;
                if (!('position' in n)) {
                    if (n.questions?.length) n.questions.forEach(c => this.nodes.push(c));
                    else this.nodes.push(n);
                }
            });

            // Setup controls for every node/question in the expanded tree
            this.nodes.forEach(n => {
                const q = this.questionnaire.questions
                    .find(x => x.nameFull === n.nameFull && !x.dropped);
                if (q) this.initControl(q);
            });
        } else {
            this.questionnaireForm = this.questionnairesForm[this.questionnaireIndex];
        }

        this.formEmitter.emit({form: this.questionnaireForm, action: null});
        this.questionnaireForm.valueChanges
            .subscribe(() => this.serializeConfiguration());
        this.serializeConfiguration();
    }


    private initControl(q: Question): void {
        if (q.type === 'section' || q.dependant) return;
        const name = q.nameFull;
        const validators: any[] = [];
        if (q.required) validators.push(Validators.required);
        if (q.type === 'number') validators.push(Validators.min(0), Validators.max(100));
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
            const opts = Array.isArray(q.answers)
                ? q.answers as string[]
                : Object.values(q.answers ?? {});
            opts.forEach((_v, idx) => answers[idx] = !!(prevVal && typeof prevVal === 'object' ? prevVal[idx] : false));
            // Restore checked boxes from saved values

            this.questionnaireForm?.addControl(`${name}_list`, this.fb.group(answers));
            this.questionnaireForm?.addControl(
                `${name}_answer`,
                new UntypedFormControl(prevVal, [Validators.required])
            );
        } else {
            this.questionnaireForm?.addControl(
                `${name}_answer`,
                new UntypedFormControl(prevVal, validators)
            );
        }
        if (q.freeText) {
            const prevFree = prevAns[`${name}_free_text`] ?? '';
            this.questionnaireForm?.addControl(
                `${name}_free_text`,
                new UntypedFormControl(prevFree)
            );
        }
    }

    public handleCheckbox(q: Question, grpName: string): void {
        let anyChecked = false;
        const grp = this.questionnaireForm?.get(grpName);
        const ctrl = this.questionnaireForm?.get(`${q.nameFull}_answer`);
        Object.values(grp?.value ?? {}).forEach(v => anyChecked ||= !!v);
        // Store the full object only if something is checked
        ctrl?.setValue(anyChecked ? grp?.value : '');
        ctrl?.markAsTouched();
    }

    public displayCheckedLabels(q: Question): string {
        const answerObj = this.questionnaireForm?.get(`${q.nameFull}_answer`)?.value;
        if (!answerObj || typeof answerObj !== 'object') return '';
        // Find which boxes are checked
        const checkedIndices = Object.entries(answerObj)
            .filter(([_, v]) => v)
            .map(([k, _]) => Number(k));
        // Get labels
        const options = Array.isArray(q.answers)
            ? q.answers
            : Object.values(q.answers ?? {});
        const selectedLabels = checkedIndices.map(idx => options[idx]);
        return selectedLabels.join(', ');
    }

    public handleQuestionDependency(q: Question): boolean {
        if (!q.dependant) return true;
        this.questionnaire.questionDependencies[q.nameFull] = false;
        walkNode(this.questionnaire.treeCut, node => {
            if (node.name === q.target && q.indexFull && q.indexFull === q.indexFull) {
                const value = this.questionnaireForm?.get(`${node.nameFull}_answer`)?.value ?? '';
                if (value !== '') {
                    const label = Array.isArray(node.answers)
                        ? (node.answers as string[])[value]
                        : node.answers?.[value];
                    if (label === q.needed) {
                        this.enableDependant(q);
                        this.questionnaire.questionDependencies[q.nameFull] = true;
                    }
                } else {
                    this.questionnaireForm?.get(`${q.nameFull}_answer`)?.clearValidators();
                    this.questionnaire.questionDependencies[q.nameFull] = false;
                }
            }
        });
        Object.entries(this.questionnaire.questionDependencies)?.forEach(
            ([nf, ok]) => {
                if (!ok) {
                    const ctrl = this.questionnaireForm?.get(`${nf}_answer`);
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
        if (q.type === 'number') validators.push(Validators.min(0), Validators.max(100));
        if (q.type === 'email') validators.push(Validators.email);
        const prev = this.mostRecentDataRecord?.loadAnswers() ?? {};
        const prevVal = prev[`${name}_answer`] ?? '';
        const prevTxt = prev[`${name}_free_text`] ?? '';
        this.questionnaireForm?.addControl(
            `${name}_answer`,
            new UntypedFormControl(prevVal, validators)
        );
        if (q.freeText) {
            this.questionnaireForm?.addControl(
                `${name}_free_text`,
                new UntypedFormControl(prevTxt)
            );
        }
    }

    public handleQuestionRepetition(q: Question): void {
        const ctrl = this.questionnaireForm?.get(`${q.nameFull}_answer`);
        if (!ctrl) return;
        for (const repQ of this.questionnaire.questionsToRepeat) {
            const updatedVal = ctrl.value;
            for (const cur of this.questionnaire.questions) {
                if (cur.target !== repQ.name) continue;
                if (updatedVal > repQ.times) continue;
                const targetNode = firstNode(this.questionnaire.treeOriginal, n => n.target === repQ.name);
                const childNodes = allNodes(this.questionnaire.treeCut, n => n.target === repQ.name);
                const parentNode = firstNode(this.questionnaire.treeCut, n => n.name === repQ.name);
                if (!targetNode || !parentNode) continue;
                if (updatedVal >= childNodes.length) {
                    for (let i = childNodes.length; i < updatedVal; i++) {
                        const newBranch: QNode = JSON.parse(JSON.stringify(targetNode));
                        const safeIndexFull = Array.isArray(parentNode.indexFull)
                            ? parentNode.indexFull.join('.')
                            : (parentNode.indexFull as string | undefined);
                        this.questionnaire.updateIndicesForRepeat(newBranch, safeIndexFull, parentNode.nameFull, i);
                        this.questionnaire.registerQuestionsFromNode(newBranch);
                        addChildNode(parentNode, newBranch);
                        this.questionnaire.questions
                            .filter(qx => !qx.dropped)
                            .forEach(qx => this.initControl(qx));
                        this.cdr.detectChanges();
                    }
                } else {
                    const toDrop = childNodes?.at(-1);
                    if (!toDrop) continue;
                    dropNode(this.questionnaire.treeCut, toDrop);
                    const removeQs: Question[] = [];
                    walkNode(toDrop, node => {
                        const m = this.questionnaire.questions.find(qx => qx.index === node.index);
                        if (m) removeQs.push(m);
                    });
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

    public handleQuestionnaireCompletion(
        action: 'Back' | 'Next' | 'Finish'
    ): void {
        this.sectionService.stepIndex += (action === 'Back' ? -1 : 1);
        this.formEmitter.emit({form: this.questionnaireForm, action});
    }

    private serializeConfiguration(): void {
        const cache = Object.keys(localStorage).filter(k => k.startsWith('questionnaire-'));
        cache.forEach(k => this.localStorageService.removeItem(k));
        const questionnairesJSON = JSON?.parse(
            JSON?.stringify(this.questionnaireForm?.get('questionnaires')?.value ?? [])
        );
        questionnairesJSON.forEach((questionnaire: any, qIdx: number) => {
            switch (questionnaire.type) {
                case 'crt':
                    delete questionnaire.description;
                    questionnaire.questions.forEach((q: any) => {
                        q.type = 'number';
                        q.required = true;
                        delete q.answers;
                    });
                    delete questionnaire.mapping;
                    break;
                case 'likert':
                    questionnaire.questions.forEach((q: any) => {
                        delete q.answers;
                        q.type = 'mcq';
                        q.required = true;
                        q.free_text = false;
                        q.detail = null;
                        q.show_detail = false;
                    });
                    break;
                case 'standard':
                    delete questionnaire.description;
                    questionnaire.questions.forEach((q: any) => {
                        const ans: string[] = [];
                        q.answers.forEach((a: any) => ans.push(a.answer));
                        q.answers = ans;
                        q.type = 'mcq';
                        q.required = true;
                        q.free_text = false;
                        q.detail = null;
                        q.show_detail = false;
                    });
                    delete questionnaire.mapping;
                    break;
                default:
                    break;
            }
            this.localStorageService.setItem(
                `questionnaire-${qIdx}`,
                JSON.stringify(questionnaire)
            );
        });
        this.configurationSerialized = JSON.stringify(questionnairesJSON);
    }
}
