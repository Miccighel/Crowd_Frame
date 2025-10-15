/* ###########################################################################
 *  Questionnaire component – Angular 19 strict-forms compliant
 *  --------------------------------------------------------------------------
 *  • Builds ALL base controls synchronously in ngOnInit (non-section, non-dependant).
 *  • Repeat branches expand live as you type (listen on (input)).
 *  • Derives questionsToRepeat if the model didn’t populate it (e.g., "how_many").
 *  • Free-text controls created for both `free_text` and `freeText`.
 *  ########################################################################### */

import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnInit,
    AfterViewInit,
    Output
} from '@angular/core';
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators
} from '@angular/forms';

/* Services ---------------------------------------------------------------- */
import {SectionService} from '../../../services/section.service';
import {LocalStorageService} from '../../../services/localStorage.service';

/* Models ------------------------------------------------------------------ */
import {
    Questionnaire,
    QNode,
    walkNode,
    firstNode,
    allNodes,
    addChildNode,
    dropNode
} from '../../../models/skeleton/questionnaires/questionnaire';
import {Question} from '../../../models/skeleton/questionnaires/question';
import {Task} from '../../../models/skeleton/task';
import {Worker} from '../../../models/worker/worker';
import {DataRecord} from '../../../models/skeleton/dataRecord';

/* Material ---------------------------------------------------------------- */
import {MatStepper} from '@angular/material/stepper';

@Component({
    selector: 'app-questionnaire',
    templateUrl: './questionnaire.component.html',
    styleUrls: ['./questionnaire.component.scss'],
    standalone: false
})
export class QuestionnaireComponent implements OnInit, AfterViewInit {

    /* ======================= INPUTS / OUTPUTS ============================ */
    @Input() questionnaireIndex!: number;
    @Input() questionnairesForm!: UntypedFormGroup[];
    @Input() stepper!: MatStepper;
    @Input() worker!: Worker;

    @Output() formEmitter = new EventEmitter<{
        form: UntypedFormGroup;
        action: 'Back' | 'Next' | 'Finish' | null;
    }>();

    /* =========================== STATE =================================== */
    questionnaireForm!: UntypedFormGroup;
    questionnaire!: Questionnaire;
    task!: Task;
    mostRecentDataRecord: DataRecord | null = null;
    configurationSerialized = '';
    ready = false; /* template gate */

    constructor(
        private changeDetector: ChangeDetectorRef,
        public sectionService: SectionService,
        private formBuilder: UntypedFormBuilder,
        private localStorageService: LocalStorageService
    ) {
        this.task = this.sectionService.task;
    }

    async ngOnInit(): Promise<void> {
        /* ---------- base init --------------------------------------------- */
        this.questionnaire = this.task.questionnaires[this.questionnaireIndex];
        this.questionnaireForm = this.formBuilder.group({});
        this.mostRecentDataRecord =
            this.task.retrieveMostRecentDataRecord('questionnaire', this.questionnaireIndex) ?? null;

        const previousAnswers: Record<string, any> = this.mostRecentDataRecord?.loadAnswers() ?? {};

        /* Safety: ensure containers exist */
        (this.questionnaire as any).questionDependencies ??= {};
        (this.questionnaire as any).questionsToRepeat ??= this.questionnaire.questionsToRepeat ?? [];

        /* ---------- derive repeat controllers if missing ------------------ */
        /* The model’s constructor may not fill questionsToRepeat. We derive it:
           pick questions that own a repeat counter (e.g., "how_many"). */
        if (!Array.isArray(this.questionnaire.questionsToRepeat) ||
            this.questionnaire.questionsToRepeat.length === 0) {
            this.questionnaire.questionsToRepeat = this.questionnaire.questions.filter(q => !!q.repeat);
        }

        /* ---------- reuse or build a new form ----------------------------- */
        if (!this.questionnairesForm[this.questionnaireIndex]) {

            /* Add ALL always-present controls (non-section, non-dependant) */
            this.addBaseControlsFromTree(this.questionnaire.treeCut, previousAnswers);

            /* Restore repeat branches & their controls from previously saved state */
            this.restoreRepeatBranches(previousAnswers);

        } else {
            this.questionnaireForm = this.questionnairesForm[this.questionnaireIndex];
        }

        /* ---------- emit & subscribe to changes --------------------------- */
        this.formEmitter.emit({form: this.questionnaireForm, action: null});
        this.questionnaireForm.valueChanges.subscribe(() => this.serializeConfiguration());
        this.serializeConfiguration();

        /* ---------- template can render now ------------------------------- */
        this.ready = true;
    }

    ngAfterViewInit(): void {
        /* MatStepper exists only now */
        if (this.stepper) {
            const currentStepIndex = this.worker.getPositionCurrent();
            this.stepper.selectedIndex = currentStepIndex;
            this.sectionService.stepIndex = currentStepIndex;
            this.changeDetector.detectChanges(); /* sync view */
        }
    }

    /* ====================== UI helpers (styling) ====================== */

    public get isSingleOverallQuestionnaire(): boolean {
        const t = this.task as any;
        const total =
            (t?.questionnaireAmount ?? 0) ||
            (Array.isArray(t?.questionnaires) ? t.questionnaires.length : 0);
        return total === 1;
    }

    /* ====================== CONTROL BUILDERS ============================ */

    private addBaseControlsFromTree(node: QNode, previousAnswers: Record<string, any>): void {
        /* Walk the current cut; add controls for renderable nodes */
        const isRenderable = node.type && node.type !== 'section' && !(node as any).dependant;
        if (isRenderable) this.addBaseControlsForQuestion(node as any, previousAnswers);
        node.questions?.forEach(child => this.addBaseControlsFromTree(child, previousAnswers));
    }

    private addBaseControlsForQuestion(questionModel: Question | any,
                                       previousAnswers: Record<string, any>): void {
        /* Skip structural sections and dependants (dependants are enabled dynamically) */
        if (questionModel.type === 'section' || questionModel.dependant) return;

        const controlKeyBase = (questionModel.nameFull ?? questionModel.name) as string;

        /* Validators */
        const validators: any[] = [];
        if (questionModel.required) validators.push(Validators.required);
        if (questionModel.type === 'number') validators.push(Validators.min(0), Validators.max(100));
        if (questionModel.type === 'email') validators.push(Validators.email);
        if (questionModel.repeat) validators.push(Validators.min(0), Validators.max(questionModel.times));

        /* Previous values */
        const answerKey = `${controlKeyBase}_answer`;
        const freeTextKey = `${controlKeyBase}_free_text`;
        const listKey = `${controlKeyBase}_list`;

        const prevAnswer = previousAnswers[answerKey] ?? '';
        const prevFreeText = previousAnswers[freeTextKey] ?? '';

        /* List/checkbox group (boolean map keyed by option index) */
        if (questionModel.type === 'list') {
            const options: string[] = Array.isArray(questionModel.answers)
                ? questionModel.answers
                : Object.values(questionModel.answers ?? {});
            const checkboxState: Record<number, boolean> = {};
            options.forEach((_, optionIndex) => checkboxState[optionIndex] = !!(prevAnswer?.[optionIndex]));
            if (!this.questionnaireForm.contains(listKey)) {
                this.questionnaireForm.addControl(listKey, this.formBuilder.group(checkboxState));
            }
        }

        /* Main answer control */
        if (!this.questionnaireForm.contains(answerKey)) {
            this.questionnaireForm.addControl(answerKey, new UntypedFormControl(prevAnswer, validators));
        }

        /* Free-text sibling — support both `free_text` and `freeText` */
        const hasFreeTextFlag = Boolean(questionModel.freeText ?? questionModel.free_text);
        if (hasFreeTextFlag && !this.questionnaireForm.contains(freeTextKey)) {
            this.questionnaireForm.addControl(freeTextKey, new UntypedFormControl(prevFreeText));
        }
    }

    /* ========================= REPEATS ================================= */

    private restoreRepeatBranches(previousAnswers: Record<string, any>): void {
        /* Expand repeat branches based on previously saved answer counts */
        const repeatControllers = this.questionnaire.questionsToRepeat ?? [];
        for (const repeatController of repeatControllers) {
            const repeatBase = repeatController.nameFull ?? repeatController.name;
            if (!repeatBase) continue;
            const repeatAnswerKey = `${repeatBase}_answer`;
            const savedRepeatCount = Number(previousAnswers[repeatAnswerKey]);
            if (savedRepeatCount && savedRepeatCount > 1) {
                if (!this.questionnaireForm.contains(repeatAnswerKey)) {
                    this.questionnaireForm.addControl(repeatAnswerKey, new UntypedFormControl(savedRepeatCount));
                }
                this.handleQuestionRepetition(repeatController);
            }
        }
    }

    /* =============== QUESTION INTERACTION HELPERS ====================== */

    public handleCheckbox(listQuestion: Question | any, checkboxGroupName: string): void {
        let anyOptionChecked = false;
        const group = this.questionnaireForm.get(checkboxGroupName);
        const answerControl = this.questionnaireForm.get(`${(listQuestion.nameFull ?? listQuestion.name)}_answer`);
        Object.values(group?.value ?? {}).forEach(v => anyOptionChecked ||= !!v);
        answerControl?.setValue(anyOptionChecked ? group?.value : '');
        answerControl?.markAsTouched();
    }

    public displayCheckedLabels(listQuestion: Question | any): string {
        const answerKey = `${(listQuestion.nameFull ?? listQuestion.name)}_answer`;
        const answerValue = this.questionnaireForm.get(answerKey)?.value;
        if (!answerValue || typeof answerValue !== 'object') return '';
        const checkedIndices = Object.entries(answerValue)
            .filter(([, isChecked]) => isChecked)
            .map(([idx]) => Number(idx));
        const options: string[] = Array.isArray(listQuestion.answers)
            ? listQuestion.answers
            : Object.values(listQuestion.answers ?? {});
        return checkedIndices.map(i => options[i]).join(', ');
    }

    public handleQuestionDependency(dependantQuestion: Question | any): boolean {
        if (!dependantQuestion.dependant) return true;

        const dependantBase = (dependantQuestion.nameFull ?? dependantQuestion.name) as string;
        this.questionnaire.questionDependencies[dependantBase] = false;

        /* Find parent by simple name; compare selected label with needed */
        walkNode(this.questionnaire.treeCut, (candidateParent: QNode) => {
            if (candidateParent.name === dependantQuestion.target) {
                const parentKey = `${(candidateParent.nameFull ?? candidateParent.name)}_answer`;
                const parentValue = this.questionnaireForm.get(parentKey)?.value ?? '';
                if (parentValue !== '') {
                    const parentLabel = Array.isArray(candidateParent.answers)
                        ? (candidateParent.answers as string[])[parentValue]
                        : (candidateParent.answers as Record<string, string> | undefined)?.[parentValue];
                    if (parentLabel === dependantQuestion.needed) {
                        this.enableDependantQuestion(dependantQuestion);
                        this.questionnaire.questionDependencies[dependantBase] = true;
                    }
                } else {
                    this.questionnaireForm.get(`${dependantBase}_answer`)?.clearValidators();
                    this.questionnaire.questionDependencies[dependantBase] = false;
                }
            }
        });

        /* Clear state for disabled dependants */
        Object.entries(this.questionnaire.questionDependencies).forEach(([nf, isEnabled]) => {
            if (!isEnabled) {
                const ctrl = this.questionnaireForm.get(`${nf}_answer`);
                ctrl?.clearValidators();
                ctrl?.setErrors(null);
                ctrl?.setValue('');
            }
        });

        return this.questionnaire.questionDependencies[dependantBase];
    }

    private enableDependantQuestion(dependantQuestion: Question | any): void {
        const baseKey = (dependantQuestion.nameFull ?? dependantQuestion.name) as string;
        const answerKey = `${baseKey}_answer`;
        const freeTextKey = `${baseKey}_free_text`;

        if (this.questionnaireForm.contains(answerKey)) return;

        const validators: any[] = [];
        if (dependantQuestion.required) validators.push(Validators.required);
        if (dependantQuestion.type === 'number') validators.push(Validators.min(0), Validators.max(100));
        if (dependantQuestion.type === 'email') validators.push(Validators.email);

        const previous = this.mostRecentDataRecord?.loadAnswers() ?? {};
        this.questionnaireForm.addControl(answerKey, new UntypedFormControl(previous[answerKey] ?? '', validators));

        /* Free-text sibling for dependants (supports both flags) */
        const hasFreeText = Boolean(dependantQuestion.freeText ?? dependantQuestion.free_text);
        if (hasFreeText && !this.questionnaireForm.contains(freeTextKey)) {
            this.questionnaireForm.addControl(freeTextKey, new UntypedFormControl(previous[freeTextKey] ?? ''));
        }
    }

    public handleQuestionRepetition(repeatQuestion: Question | any): void {
        /* Recalculate branches under a repeat controller (e.g., "how_many") */
        const repeatAnswerKey = `${(repeatQuestion.nameFull ?? repeatQuestion.name)}_answer`;
        const repeatControl = this.questionnaireForm.get(repeatAnswerKey);
        if (!repeatControl) return;

        const desiredBranchCount = Number(repeatControl.value);

        /* Ensure we have the config for this repeat controller */
        const repeatConfig = (this.questionnaire.questionsToRepeat ?? []).find(r => r.name === repeatQuestion.name);
        if (!repeatConfig) return;
        if (desiredBranchCount > repeatConfig.times) return;

        /* Identify original template branch and current children in the cut */
        const templateBranch = firstNode(this.questionnaire.treeOriginal, n => n.target === repeatConfig.name);
        const currentBranches = allNodes(this.questionnaire.treeCut, n => n.target === repeatConfig.name);
        const repeatParentNode = firstNode(this.questionnaire.treeCut, n => n.name === repeatConfig.name);
        if (!templateBranch || !repeatParentNode) return;

        /* ---- Increase (add branches) ------------------------------------- */
        if (desiredBranchCount >= currentBranches.length) {
            for (let branchIndex = currentBranches.length; branchIndex < desiredBranchCount; branchIndex++) {
                const clonedBranch: QNode = JSON.parse(JSON.stringify(templateBranch));
                const parentIndexFull = Array.isArray((repeatParentNode as any).indexFull)
                    ? (repeatParentNode as any).indexFull.join('.')
                    : (repeatParentNode as any).indexFull as string | undefined;

                this.questionnaire.updateIndicesForRepeat(
                    clonedBranch,
                    parentIndexFull,
                    (repeatParentNode as any).nameFull,
                    branchIndex
                );

                this.questionnaire.registerQuestionsFromNode(clonedBranch);
                addChildNode(repeatParentNode, clonedBranch);

                /* Initialize controls for each newly visible question */
                walkNode(clonedBranch, (newNode: QNode) => {
                    if (newNode.type && newNode.type !== 'section' && !(newNode as any).dependant) {
                        this.addBaseControlsForQuestion(newNode as any, {});
                    }
                });

                this.changeDetector.detectChanges();
            }

            /* ---- Decrease (drop last branch) --------------------------------- */
        } else {
            const lastBranch = currentBranches.at(-1);
            if (!lastBranch) return;

            dropNode(this.questionnaire.treeCut, lastBranch);

            /* Remove controls belonging to the dropped subtree */
            walkNode(lastBranch, (removed: QNode) => {
                const baseKey = (removed.nameFull ?? removed.name) as string | undefined;
                if (!baseKey) return;
                this.questionnaireForm.removeControl(`${baseKey}_answer`);
                this.questionnaireForm.removeControl(`${baseKey}_free_text`);
                this.questionnaireForm.removeControl(`${baseKey}_list`);
                delete this.questionnaire.questionDependencies[baseKey];
            });
        }
    }

    /* ===================== NAVIGATION / SERIALISATION =================== */

    public handleQuestionnaireCompletion(action: 'Back' | 'Next' | 'Finish'): void {
        this.sectionService.stepIndex += (action === 'Back' ? -1 : 1);
        this.formEmitter.emit({form: this.questionnaireForm, action});
    }

    private serializeConfiguration(): void {
        const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('questionnaire-'));
        cacheKeys.forEach(k => this.localStorageService.removeItem(k));

        const questionnairesJSON = JSON.parse(
            JSON.stringify(this.questionnaireForm.get('questionnaires')?.value ?? [])
        );

        questionnairesJSON.forEach((serialized: any, qIdx: number) => {
            switch (serialized.type) {
                case 'crt':
                    delete serialized.description;
                    serialized.questions.forEach((q: any) => {
                        q.type = 'number';
                        q.required = true;
                        delete q.answers;
                    });
                    delete serialized.mapping;
                    break;

                case 'likert':
                    serialized.questions.forEach((q: any) => {
                        delete q.answers;
                        q.type = 'mcq';
                        q.required = true;
                        q.free_text = false;
                        q.detail = null;
                        q.show_detail = false;
                    });
                    break;

                case 'standard':
                    delete serialized.description;
                    serialized.questions.forEach((q: any) => {
                        const flatAnswers: string[] = [];
                        q.answers.forEach((a: any) => flatAnswers.push(a.answer));
                        q.answers = flatAnswers;
                        q.type = 'mcq';
                        q.required = true;
                        q.free_text = false;
                        q.detail = null;
                        q.show_detail = false;
                    });
                    delete serialized.mapping;
                    break;

                default:
                    break;
            }

            this.localStorageService.setItem(
                `questionnaire-${qIdx}`,
                JSON.stringify(serialized)
            );
        });

        this.configurationSerialized = JSON.stringify(questionnairesJSON);
    }
}
