/* ###########################################################################
 *  Questionnaire component – Angular 19 strict-forms compliant
 *  --------------------------------------------------------------------------
 *  − Builds ALL base controls synchronously in ngOnInit.
 *  − Wait-flag `ready` lets the template render only after the form is ready.
 *  − ViewChild MatStepper is accessed in ngAfterViewInit (never in ngOnInit).
 *  − Original repeat / dependency / serialisation logic preserved.
 *  ########################################################################### */

// TODO(strict-forms): auto-guarded by codemod – reviewed & finalised.
import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnInit,
    AfterViewInit,
    Output,
} from '@angular/core';
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators,
} from '@angular/forms';

/* Services ---------------------------------------------------------------- */
import { SectionService }      from '../../../services/section.service';
import { LocalStorageService } from '../../../services/localStorage.service';

/* Models ------------------------------------------------------------------ */
import {
    Questionnaire,
    QNode,
    walkNode,
    firstNode,
    allNodes,
    addChildNode,
    dropNode,
} from '../../../models/skeleton/questionnaires/questionnaire';
import { Question }    from '../../../models/skeleton/questionnaires/question';
import { Task }        from '../../../models/skeleton/task';
import { Worker }      from '../../../models/worker/worker';
import { DataRecord }  from '../../../models/skeleton/dataRecord';

/* Material ---------------------------------------------------------------- */
import { MatStepper } from '@angular/material/stepper';

@Component({
    selector   : 'app-questionnaire',
    templateUrl: './questionnaire.component.html',
    styleUrls  : ['./questionnaire.component.scss'],
    standalone : false,
})
export class QuestionnaireComponent implements OnInit, AfterViewInit {

    /* ======================= INPUTS / OUTPUTS ============================ */
    @Input() questionnaireIndex!: number;
    @Input() questionnairesForm!: UntypedFormGroup[];
    @Input() stepper!: MatStepper;
    @Input() worker!: Worker;

    @Output() formEmitter = new EventEmitter<{
        form  : UntypedFormGroup;
        action: 'Back' | 'Next' | 'Finish' | null;
    }>();

    /* =========================== STATE =================================== */
    questionnaireForm!: UntypedFormGroup;        // reactive form
    questionnaire!: Questionnaire;
    task!: Task;
    mostRecentDataRecord: DataRecord | null = null;
    nodes: QNode[] = [];
    configurationSerialized = '';

    /* Template gate: becomes true once the form is ready */
    ready = false;

    /* ========================= LIFE-CYCLE ================================ */
    constructor(
        private cdr: ChangeDetectorRef,
        public  sectionService: SectionService,
        private fb: UntypedFormBuilder,
        private localStorageService: LocalStorageService,
    ) {
        this.task = this.sectionService.task;
    }

    async ngOnInit(): Promise<void> {

        /* ---------- base initialisation -------------------------------- */
        this.questionnaire   = this.task.questionnaires[this.questionnaireIndex];
        this.questionnaireForm = this.fb.group({});
        this.mostRecentDataRecord =
            this.task.retrieveMostRecentDataRecord('questionnaire', this.questionnaireIndex) ?? null;

        const prevAnswers = this.mostRecentDataRecord?.loadAnswers() ?? {};

        /* ---------- reuse or build brand-new form ---------------------- */
        if (!this.questionnairesForm[this.questionnaireIndex]) {

            /* 1️⃣  add ALL always-present controls */
            this.questionnaire.questions.forEach(q => this.initControl(q, prevAnswers));

            /* 2️⃣  restore repeat branches & their controls */
            this.restoreRepeats(prevAnswers);

        } else {
            this.questionnaireForm = this.questionnairesForm[this.questionnaireIndex];
        }

        /* ---------- emit & watch changes ------------------------------- */
        this.formEmitter.emit({ form: this.questionnaireForm, action: null });
        this.questionnaireForm.valueChanges.subscribe(() => this.serializeConfiguration());
        this.serializeConfiguration();

        /* ---------- template can render now ---------------------------- */
        this.ready = true;
    }

    ngAfterViewInit(): void {
        /* MatStepper exists only now */
        if (this.stepper) {
            this.stepper.selectedIndex = this.worker.getPositionCurrent();
            this.sectionService.stepIndex = this.worker.getPositionCurrent();
            this.cdr.detectChanges();                 // sync view
        }
    }

    /* ====================== CONTROL BUILDERS ============================ */
    private initControl(q: Question, prev: Record<string, any>): void {
        if (q.type === 'section' || q.dependant) return;

        /* ---- validators ---------------------------------------------- */
        const v: any[] = [];
        if (q.required)         v.push(Validators.required);
        if (q.type === 'number')v.push(Validators.min(0), Validators.max(100));
        if (q.type === 'email') v.push(Validators.email);
        if (q.repeat)           v.push(Validators.min(0), Validators.max(q.times));

        /* ---- previous value(s) --------------------------------------- */
        const prevVal  = prev[`${q.nameFull}_answer`]    ?? '';
        const prevFree = prev[`${q.nameFull}_free_text`] ?? '';

        /* ---- add controls -------------------------------------------- */
        if (q.type === 'list') {
            const opts = Array.isArray(q.answers) ? q.answers : Object.values(q.answers ?? {});
            const listState: Record<number, boolean> = {};
            opts.forEach((_, i) => listState[i] = !!(prevVal?.[i]));
            this.questionnaireForm.addControl(`${q.nameFull}_list`, this.fb.group(listState));
        }
        this.questionnaireForm.addControl(`${q.nameFull}_answer`, new UntypedFormControl(prevVal, v));
        if (q.freeText) {
            this.questionnaireForm.addControl(`${q.nameFull}_free_text`, new UntypedFormControl(prevFree));
        }
    }

    /* ========================= REPEATS ================================= */
    private restoreRepeats(prev: Record<string, any>): void {
        this.questionnaire.questions.filter(q => q.repeat).forEach(q => {
            const repeatCount = Number(prev[`${q.nameFull}_answer`]);
            if (repeatCount && repeatCount > 1) {
                if (!this.questionnaireForm.contains(`${q.nameFull}_answer`)) {
                    this.questionnaireForm.addControl(
                        `${q.nameFull}_answer`,
                        new UntypedFormControl(repeatCount)
                    );
                }
                this.handleQuestionRepetition(q);
            }
        });

        /* store nodes for later helpers */
        this.nodes = [];
        walkNode(this.questionnaire.treeCut, n => {
            if (n === this.questionnaire.treeCut) return;
            if (!('position' in n)) {
                if (n.questions?.length) n.questions.forEach(c => this.nodes.push(c));
                else this.nodes.push(n);
            }
        });
    }

    /* =============== QUESTION INTERACTION HELPERS ====================== */
    public handleCheckbox(q: Question, grpName: string): void {
        let anyChecked = false;
        const grp  = this.questionnaireForm.get(grpName);
        const ctrl = this.questionnaireForm.get(`${q.nameFull}_answer`);
        Object.values(grp?.value ?? {}).forEach(v => anyChecked ||= !!v);
        ctrl?.setValue(anyChecked ? grp?.value : '');
        ctrl?.markAsTouched();
    }

    public displayCheckedLabels(q: Question): string {
        const answerObj = this.questionnaireForm.get(`${q.nameFull}_answer`)?.value;
        if (!answerObj || typeof answerObj !== 'object') return '';
        const checkedIdx = Object.entries(answerObj).filter(([,v]) => v).map(([k]) => Number(k));
        const options = Array.isArray(q.answers) ? q.answers : Object.values(q.answers ?? {});
        return checkedIdx.map(i => options[i]).join(', ');
    }

    public handleQuestionDependency(q: Question): boolean {
        if (!q.dependant) return true;
        this.questionnaire.questionDependencies[q.nameFull] = false;

        walkNode(this.questionnaire.treeCut, node => {
            if (node.name === q.target && q.indexFull && q.indexFull === q.indexFull) {
                const value = this.questionnaireForm.get(`${node.nameFull}_answer`)?.value ?? '';
                if (value !== '') {
                    const label = Array.isArray(node.answers)
                        ? (node.answers as string[])[value]
                        : node.answers?.[value];
                    if (label === q.needed) {
                        this.enableDependant(q);
                        this.questionnaire.questionDependencies[q.nameFull] = true;
                    }
                } else {
                    this.questionnaireForm.get(`${q.nameFull}_answer`)?.clearValidators();
                    this.questionnaire.questionDependencies[q.nameFull] = false;
                }
            }
        });

        Object.entries(this.questionnaire.questionDependencies).forEach(([nf, ok]) => {
            if (!ok) {
                const ctrl = this.questionnaireForm.get(`${nf}_answer`);
                ctrl?.clearValidators();
                ctrl?.setErrors(null);
                ctrl?.setValue('');
            }
        });
        return this.questionnaire.questionDependencies[q.nameFull];
    }

    private enableDependant(q: Question): void {
        if (this.questionnaireForm.contains(`${q.nameFull}_answer`)) return;

        const v: any[] = [];
        if (q.required)         v.push(Validators.required);
        if (q.type === 'number')v.push(Validators.min(0), Validators.max(100));
        if (q.type === 'email') v.push(Validators.email);

        const prev = this.mostRecentDataRecord?.loadAnswers() ?? {};
        this.questionnaireForm.addControl(
            `${q.nameFull}_answer`,
            new UntypedFormControl(prev[`${q.nameFull}_answer`] ?? '', v)
        );
        if (q.freeText) {
            this.questionnaireForm.addControl(
                `${q.nameFull}_free_text`,
                new UntypedFormControl(prev[`${q.nameFull}_free_text`] ?? '')
            );
        }
    }

    public handleQuestionRepetition(q: Question): void {
        const ctrl = this.questionnaireForm.get(`${q.nameFull}_answer`);
        if (!ctrl) return;

        for (const repQ of this.questionnaire.questionsToRepeat) {
            const updatedVal = ctrl.value;

            for (const cur of this.questionnaire.questions) {
                if (cur.target !== repQ.name) continue;
                if (updatedVal > repQ.times) continue;

                const targetNode = firstNode(this.questionnaire.treeOriginal, n => n.target === repQ.name);
                const childNodes = allNodes(this.questionnaire.treeCut,      n => n.target === repQ.name);
                const parentNode = firstNode(this.questionnaire.treeCut,     n => n.name   === repQ.name);
                if (!targetNode || !parentNode) continue;

                /* ---- increase repeats ---------------------------------- */
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
                            .forEach(qx => this.initControl(qx, {}));
                        this.cdr.detectChanges();
                    }
                /* ---- decrease repeats ---------------------------------- */
                } else {
                    const toDrop = childNodes.at(-1);
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

    /* ===================== NAVIGATION / SERIALISATION =================== */
    public handleQuestionnaireCompletion(action: 'Back' | 'Next' | 'Finish'): void {
        this.sectionService.stepIndex += (action === 'Back' ? -1 : 1);
        this.formEmitter.emit({ form: this.questionnaireForm, action });
    }

    private serializeConfiguration(): void {
        const cache = Object.keys(localStorage).filter(k => k.startsWith('questionnaire-'));
        cache.forEach(k => this.localStorageService.removeItem(k));

        const questionnairesJSON = JSON.parse(
            JSON.stringify(this.questionnaireForm.get('questionnaires')?.value ?? [])
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
