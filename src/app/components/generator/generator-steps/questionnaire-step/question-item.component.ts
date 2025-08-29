/* =============================================================================
 * QuestionItemComponent
 * -----------------------------------------------------------------------------
 * Purpose:
 *   Render and manage a single questionnaire "question" node with support for:
 *     • base fields (name, type, text, required)
 *     • optional flags (show_detail, free_text)
 *     • answers editor for mcq/list types
 *     • branching/repeat metadata (target, dependant, needed, repeat/times)
 *     • nested children for "section" type (recursion)
 *
 * Notes:
 *   - Uses reactive forms (untyped here for compatibility with existing code).
 *   - Provides stable @for track functions (trackCtrl / trackTarget) to avoid
 *     Angular’s NG0956 warning by assigning an internal, stable __trackId to
 *     AbstractControls the first time they are seen.
 *   - Computes targetOptions from upstream questions only, based on a "path"
 *     array (e.g. [0,2,1]) representing this node’s position in the root tree.
 *   - Keeps API surface compatible with prior templates/usages.
 * =========================================================================== */

import {
    Component,
    Input,
    OnInit,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import {
    AbstractControl,
    UntypedFormArray,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from '@angular/forms';

type TargetOption = { name: string; label: string };

@Component({
    selector: 'app-question-item',
    templateUrl: './question-item.component.html',
    styleUrls: ['./question-item.component.scss'],
    standalone: false,
})
export class QuestionItemComponent implements OnInit, OnChanges {
    /* ---------------------------------------------------------------------------
     * Inputs provided by the parent component/template
     * ------------------------------------------------------------------------ */

    /** The FormGroup backing this question node. Expected controls:
     *  name, type, text, required, show_detail, free_text,
     *  answers (FormArray of {answer}), repeat, times,
     *  target, dependant, needed,
     *  questions (FormArray) for section type.
     */
    @Input() questionGroup!: UntypedFormGroup;

    /** Parent FormArray that contains this node (for removeThisQuestion). */
    @Input() parentQuestionsArray?: UntypedFormArray;

    /** Index of this question within the parent FormArray. */
    @Input() parentIndex?: number;

    /** The root questions FormArray to compute upstream "target" candidates. */
    @Input() rootQuestionsArray?: UntypedFormArray;

    /** Visual indentation level for nested sections. */
    @Input() indentLevel = 0;

    /**
     * Path for this node within the root questions tree (e.g., [0,2,1]).
     * Used to determine which nodes are "upstream" when building targetOptions.
     */
    @Input() path: number[] = [];

    /* ---------------------------------------------------------------------------
     * UI data derived from form state
     * ------------------------------------------------------------------------ */

    /** Options for the "target" select, showing only upstream questions. */
    public targetOptions: TargetOption[] = [];

    /* ---------------------------------------------------------------------------
     * Stable tracking helpers to avoid NG0956 (re-creation of collections)
     * ------------------------------------------------------------------------ */

    /** Internal seed used to attach a stable __trackId to AbstractControls. */
    private _trackIdSeed = 0;

    /**
     * Track function for controls inside @for loops.
     * Assigns (once) a stable numeric __trackId to each control instance, and
     * uses that for tracking instead of object identity.
     */
    public trackCtrl = (_: number, ctrl: AbstractControl): number => {
        const anyCtrl = ctrl as any;
        return anyCtrl.__trackId ?? (anyCtrl.__trackId = ++this._trackIdSeed);
    };

    /**
     * Track function for target options: prefers the stable "name" field,
     * falls back to the loop index if not available.
     */
    public trackTarget = (i: number, opt: Partial<TargetOption>): string | number =>
        opt?.name ?? i;

    /* ---------------------------------------------------------------------------
     * Lifecycle
     * ------------------------------------------------------------------------ */

    constructor(private fb: UntypedFormBuilder) {
    }

    ngOnInit(): void {
        this.recomputeTargetOptions();
        this.applyTypeSpecificValidators();
    }

    ngOnChanges(changes: SimpleChanges): void {
        // Any change that could alter upstream context → recompute targets
        if (
            changes['rootQuestionsArray'] ||
            changes['path'] ||
            changes['questionGroup']
        ) {
            this.recomputeTargetOptions();
        }
    }

    /* ---------------------------------------------------------------------------
     * Public API used by the template
     * ------------------------------------------------------------------------ */

    /** Convenience getter for the question "type". */
    public questionType(): string {
        return this.questionGroup?.get('type')?.value ?? '';
    }

    /** Answers FormArray accessor (for mcq/list). */
    public answersArray(): UntypedFormArray {
        return (this.questionGroup.get('answers') as UntypedFormArray) ?? this.fb.array([]);
    }

    /** Children FormArray accessor (for section). */
    public childQuestionsArray(): UntypedFormArray {
        return (this.questionGroup.get('questions') as UntypedFormArray) ?? this.fb.array([]);
    }

    /** Add a blank answer row. */
    public addAnswerRow(): void {
        const row = this.fb.group({
            answer: ['', Validators.required],
        });
        this.answersArray().push(row);
    }

    /** Remove an answer row by index. */
    public removeAnswerRow(index: number): void {
        const arr = this.answersArray();
        if (index >= 0 && index < arr.length) {
            arr.removeAt(index);
        }
    }

    /** Add a blank child question (minimal shape to remain compatible). */
    public addChildQuestion(): void {
        const child = this.fb.group({
            name: ['', Validators.required],
            type: ['text', Validators.required],
            text: ['', Validators.required],
            required: [false],
            show_detail: [false],
            free_text: [false],
            // mcq/list
            answers: this.fb.array([]),
            // branching/repeat
            repeat: [false],
            times: [null],
            target: [''],
            dependant: [false],
            needed: [''],
            // nested children for a section
            questions: this.fb.array([]),
        });
        this.childQuestionsArray().push(child);
    }

    /** Remove this question node from the parent array. */
    public removeThisQuestion(): void {
        if (!this.parentQuestionsArray || this.parentIndex == null) return;
        if (this.parentIndex >= 0 && this.parentIndex < this.parentQuestionsArray.length) {
            this.parentQuestionsArray.removeAt(this.parentIndex);
        }
    }

    /** React to type changes (e.g., add/remove validators relevant to the type). */
    public onQuestionTypeChange(): void {
        this.applyTypeSpecificValidators();
    }

    /* ---------------------------------------------------------------------------
     * Internal helpers
     * ------------------------------------------------------------------------ */

    /**
     * Ensure validators reflect the current "type".
     * - For "mcq" and "list": answers required (at least one).
     * - For "repeat": times must be >= 1 when repeat is true.
     * - For "dependant": needed and target must be present.
     */
    private applyTypeSpecificValidators(): void {
        const type = this.questionType();
        const answers = this.answersArray();

        // MCQ / List: ensure at least one row exists and each has required validator
        if (type === 'mcq' || type === 'list') {
            if (answers.length === 0) {
                answers.push(this.fb.group({answer: ['', Validators.required]}));
            } else {
                for (let i = 0; i < answers.length; i++) {
                    const ctrl = answers.at(i).get('answer');
                    ctrl?.setValidators(Validators.required);
                    ctrl?.updateValueAndValidity({emitEvent: false});
                }
            }
        } else {
            // Other types: not enforcing answers presence; clear validators
            for (let i = 0; i < answers.length; i++) {
                const ctrl = answers.at(i).get('answer');
                ctrl?.clearValidators();
                ctrl?.updateValueAndValidity({emitEvent: false});
            }
        }

        // Repeat → times required & min(1)
        const repeat = this.questionGroup.get('repeat')?.value === true;
        const timesCtrl = this.questionGroup.get('times');
        if (repeat) {
            timesCtrl?.setValidators([Validators.required, Validators.min(1)]);
        } else {
            timesCtrl?.clearValidators();
            timesCtrl?.setValue(null, {emitEvent: false});
        }
        timesCtrl?.updateValueAndValidity({emitEvent: false});

        // Dependant → target & needed required
        const dependant = this.questionGroup.get('dependant')?.value === true;
        const targetCtrl = this.questionGroup.get('target');
        const neededCtrl = this.questionGroup.get('needed');
        if (dependant) {
            targetCtrl?.setValidators([Validators.required]);
            neededCtrl?.setValidators([Validators.required]);
        } else {
            targetCtrl?.clearValidators();
            neededCtrl?.clearValidators();
            // do not force-clear values; user may toggle back on
        }
        targetCtrl?.updateValueAndValidity({emitEvent: false});
        neededCtrl?.updateValueAndValidity({emitEvent: false});
    }

    /**
     * Rebuild targetOptions using only "upstream" questions relative to this.path.
     * The walk is depth-first; a node is considered upstream if its path is
     * lexicographically before this.path OR is a strict ancestor of this.path.
     */
    private recomputeTargetOptions(): void {
        this.targetOptions = [];
        if (!this.rootQuestionsArray) return;

        const out: TargetOption[] = [];
        this.walkUpstream(this.rootQuestionsArray, [], this.path, out);
        // remove self (if present) and dedupe by name
        const selfName = this.questionGroup.get('name')?.value;
        const seen = new Set<string>();
        this.targetOptions = out
            .filter(o => o.name && o.name !== selfName)
            .filter(o => (seen.has(o.name) ? false : (seen.add(o.name), true)));
    }

    /**
     * Depth-first walk; pushes questions whose path is "before" the currentPath.
     * A path A is before B if:
     *   - A is a strict prefix of B (ancestor), or
     *   - At the first differing index k, A[k] < B[k].
     */
    private walkUpstream(
        arr: UntypedFormArray,
        _trail: number[],
        currentPath: number[],
        out: TargetOption[]
    ): void {
        for (let i = 0; i < arr.length; i++) {
            const ctrl = arr.at(i) as UntypedFormGroup;
            const here = [..._trail, i];

            if (this.isBefore(here, currentPath)) {
                const name = String(ctrl.get('name')?.value ?? '');
                if (name) {
                    out.push({name, label: name});
                }
            }

            // Recurse into children if this is a section
            const t = String(ctrl.get('type')?.value ?? '');
            if (t === 'section') {
                const kids = ctrl.get('questions') as UntypedFormArray;
                if (kids) this.walkUpstream(kids, here, currentPath, out);
            }
        }
    }

    /** Lexicographic compare on arrays; true if a is an ancestor of b or a<b. */
    private isBefore(a: number[], b: number[]): boolean {
        const n = Math.min(a.length, b.length);
        for (let k = 0; k < n; k++) {
            if (a[k] < b[k]) return true;
            if (a[k] > b[k]) return false;
        }
        // all equal up to n; a is ancestor if shorter
        return a.length < b.length;
    }
}
