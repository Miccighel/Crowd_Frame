/* =============================================================================
 * SAMPLE CONFIGURATION – EXPLANATION
 * -----------------------------------------------------------------------------
 * Structure
 *   • The configuration is an array of "questionnaires".
 *   • Each questionnaire has meta (index, description, position, type, allow_back)
 *     and a tree of "questions".
 *
 * Questionnaire #1 (index: 1)
 *   • type: "standard", position: "start", allow_back: true
 *   • description: "Current Perception of Longitudinal Studies"
 *   • questions:
 *       1) SECTION previous_participation
 *          - Asks if the worker participated in prior longitudinal studies.
 *          - Contains:
 *              a) NUMBER how_many
 *                 - repeat: true, times: 3  (creates three repeated blocks)
 *                 - Drives the next nested SECTION via target="how_many".
 *              b) SECTION past_experiences
 *                 - text: "Describe your experience with the longitudinal study nr. "
 *                 - target: "how_many"  (binds to the repeater above)
 *                 - Contains a set of questions describing each past study:
 *                     • when     : MCQ with time ranges (required)
 *                     • sessions : NUMBER (#sessions, required)
 *                     • time_interval : MCQ with time gaps (free_text allowed)
 *                     • time_duration : MCQ with durations  (free_text allowed)
 *                     • platform : MCQ listing platforms  (free_text allowed)
 *                     • payment_model : LIST ("Payment after each session", "Single final reward")
 *                     • SECTION satisfaction
 *                         - same_study : MCQ Yes/No (required)
 *                         - why        : TEXT (required)
 *                     • incentives : MCQ listing motivating factors (free_text allowed)
 *                     • task_completion : MCQ Yes/No (required)
 *                         - dependant children:
 *                             - yes : MCQ, dependant=true, target="task_completion", needed="Yes"
 *                             - no  : TEXT, dependant=true, target="task_completion", needed="No"
 *       2) TEXT  suitability (required)
 *       3) LIST  common     (statements; free_text allowed)
 *
 * Questionnaire #2 (index: 2)
 *   • type: "standard", position: "start", allow_back: true
 *   • description: "Your possible participation and commitment to longitudinal studies"
 *   • questions:
 *       • NUMBER daily_commitment              (required)
 *       • LIST   ls_decline                    (multi reasons)
 *       • MCQ    which_commitment              (preferred cadence)
 *       • NUMBER ideal_session                 (hours)
 *       • NUMBER ideal_hourly_payment          (USD)
 *       • NUMBER time_per_day                  (hours per day)
 *       • LIST   incentives_motivation         (motivators)
 *       • LIST   task_type                     (task families)
 *       • LIST   benefits                      (benefits)
 *       • LIST   downsides                     (downsides)
 *       • TEXT   suggestions                   (required)
 *
 * Questionnaire #3 (index: 3)
 *   • type: "standard", position: "start"
 *   • questions:
 *       • SECTION share_email
 *           - EMAIL address (optional), to be contacted for interview
 *
 * Conventions enforced by the editor/serializer
 *   • question.type ∈ {text, number, email, mcq, list, section}
 *   • mcq/list answers are emitted as string[]
 *   • dependant logic uses {target, dependant: true, needed}
 *   • repeater logic uses {repeat: true, times}
 *   • Likert/CRT modes are supported independently (not used in this sample).
 * ============================================================================ */

import {Component, EventEmitter, OnInit, Output} from "@angular/core";
import {
    UntypedFormArray,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from "@angular/forms";

/* Services */
import {ConfigService} from "../../../../services/config.service";
import {LocalStorageService} from "../../../../services/localStorage.service";
import {S3Service} from "../../../../services/aws/s3.service";

/* Models */
import {Questionnaire} from "../../../../models/skeleton/questionnaires/questionnaire";
import {Question} from "../../../../models/skeleton/questionnaires/question";

interface QuestionnaireTypeOption {
    value: string;
    viewValue: string;
}

interface QuestionnairePositionOption {
    value: string;
    viewValue: string;
}

@Component({
    selector: "app-questionnaire-step",
    templateUrl: "./questionnaire-step.component.html",
    styleUrls: ["../../generator.component.scss", "./questionnaire-step.component.scss"],
    standalone: false,
})
export class QuestionnaireStepComponent implements OnInit {
    /* Service references */
    configService: ConfigService;
    s3Service: S3Service;
    localStorageService: LocalStorageService;

    /* Backing store from LocalStorage or S3 */
    persistedQuestionnaires: Array<Questionnaire> = [];

    /* Root form for the step */
    formStep: UntypedFormGroup;

    /* Select options */
    questionnaireTypes: QuestionnaireTypeOption[] = [
        {value: "crt", viewValue: "CRT"},
        {value: "likert", viewValue: "Likert"},
        {value: "standard", viewValue: "Standard"},
    ];
    questionnairePosition: QuestionnairePositionOption[] = [
        {value: "start", viewValue: "Start"},
        {value: "end", viewValue: "End"},
    ];

    /* Serialized preview bound to the next step */
    configurationSerialized = "";

    /* Emitter to notify the parent stepper */
    @Output() formEmitter: EventEmitter<UntypedFormGroup>;

    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        s3Service: S3Service,
        private formBuilder: UntypedFormBuilder
    ) {
        this.configService = configService;
        this.s3Service = s3Service;
        this.localStorageService = localStorageService;

        this.formStep = this.formBuilder.group({
            questionnaires: this.formBuilder.array([]),
        });

        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    public async ngOnInit() {
        /* Load from LocalStorage if present; otherwise bootstrap from S3. */
        const questionnaireKeys = Object.keys(localStorage).filter((key) =>
            key.startsWith("questionnaire-")
        );

        if (questionnaireKeys.length > 0) {
            questionnaireKeys.forEach((key) => {
                const indexString = key.split("-")[1];
                const storedValue = this.localStorageService.getItem(key);
                this.persistedQuestionnaires.push(
                    new Questionnaire(parseInt(indexString, 10), JSON.parse(storedValue))
                );
            });
            this.persistedQuestionnaires.sort((a, b) => (a.index > b.index ? 1 : -1));
        } else {
            const downloaded = await this.s3Service.downloadQuestionnaires(
                this.configService.environment
            );
            downloaded.forEach((raw, idx) => {
                const questionnaire = new Questionnaire(idx, raw);
                this.persistedQuestionnaires.push(questionnaire.serializable());
                this.localStorageService.setItem(
                    `questionnaire-${idx}`,
                    JSON.stringify(questionnaire.serializable())
                );
            });
        }

        /* Hydrate the form with existing questionnaires if available. */
        if (this.persistedQuestionnaires.length > 0) {
            this.persistedQuestionnaires.forEach((q, idx) =>
                this.addQuestionnaire(idx, q)
            );
        }

        /* Auto-serialize on changes. */
        this.formStep.valueChanges.subscribe(() => this.serializeConfiguration());
        this.serializeConfiguration();

        /* Notify parent stepper. */
        this.formEmitter.emit(this.formStep);
    }

    /* -------------------- Accessors -------------------- */
    questionnairesArray(): UntypedFormArray {
        return this.formStep.get("questionnaires") as UntypedFormArray;
    }

    questionArrayAt(questionnaireIndex: number): UntypedFormArray {
        return this.questionnairesArray()
            .at(questionnaireIndex)
            .get("questions") as UntypedFormArray;
    }

    answersArrayAt(questionnaireIndex: number, questionIndex: number): UntypedFormArray {
        return this.questionArrayAt(questionnaireIndex)
            .at(questionIndex)
            .get("answers") as UntypedFormArray;
    }

    mappingArrayAt(questionnaireIndex: number): UntypedFormArray {
        return this.questionnairesArray()
            .at(questionnaireIndex)
            .get("mapping") as UntypedFormArray;
    }

    /* Helpers for template error display */
    hasQuestionnaireErrors(i: number): boolean {
        return !!this.questionnairesArray().at(i).errors;
    }

    getQuestionnaireErrors(i: number): any {
        return this.questionnairesArray().at(i).errors || {};
    }

    /* Mark everything as touched to reveal errors (used on Next) */
    markAllAsTouched(): void {
        const qArr = this.questionnairesArray();
        qArr.controls.forEach((qg) => {
            qg.markAllAsTouched();
            (qg.get('questions') as UntypedFormArray)?.controls.forEach(c => c.markAllAsTouched());
            (qg.get('mapping') as UntypedFormArray)?.controls.forEach(c => c.markAllAsTouched());
        });
    }

    /* ---------------- Questionnaire mutations ---------------- */
    addQuestionnaire(
        questionnaireIndex: number | null = null,
        seed: Questionnaire | any | null = null
    ) {
        const questionnaireGroup = this.formBuilder.group({
            type: [seed?.type ?? "", [Validators.required]],
            position: [seed?.position ?? "", [Validators.required]], /* now required */
            description: [seed?.description ?? ""],
            allow_back: [seed?.allow_back ?? false],
            questions: this.formBuilder.array([]),
            mapping: this.formBuilder.array([]), /* UI control name is "mapping" */
        });

        /* Attach cross-node validator and validate once. */
        questionnaireGroup.setValidators(this.questionnaireStructureValidator);
        questionnaireGroup.updateValueAndValidity({emitEvent: false});

        this.questionnairesArray().push(questionnaireGroup);

        const resolvedIndex =
            questionnaireIndex ?? this.questionnairesArray().length - 1;

        /* Hydrate questions if provided. Otherwise, seed an empty row when type is set. */
        if (seed?.questions?.length) {
            seed.questions.forEach((questionSeed: any, i: number) =>
                this.addQuestion(resolvedIndex, i, questionSeed)
            );
        } else {
            const typeValue = questionnaireGroup.get("type")?.value;
            if (typeValue && typeValue !== "") this.addQuestion(resolvedIndex);
        }

        /* Hydrate mapping from either "mapping" (UI/JSON) or "mappings" (model). */
        const incomingMapping =
            (seed as any)?.mapping ?? (seed as any)?.mappings ?? [];
        if (Array.isArray(incomingMapping) && incomingMapping.length) {
            incomingMapping.forEach((m: any) =>
                this.mappingArrayAt(resolvedIndex).push(
                    this.formBuilder.group({
                        label: [m?.label ?? "", [Validators.required]],
                        value: [m?.value ?? "", [Validators.required]],
                    })
                )
            );
        }
    }

    removeQuestionnaire(questionnaireIndex: number): void {
        this.questionnairesArray().removeAt(questionnaireIndex);
    }

    updateQuestionnaire(questionnaireIndex: number): void {
        /* Resets questions and mapping for a clean state on type change. */
        const questionnaireGroup = this.questionnairesArray().at(questionnaireIndex);
        const questionArray = questionnaireGroup.get("questions") as UntypedFormArray;
        const mappingArray = questionnaireGroup.get("mapping") as UntypedFormArray;

        questionArray.clear();
        mappingArray.clear();

        this.addQuestion(questionnaireIndex);

        if (questionnaireGroup.get("type")?.value === "likert") {
            this.addMapping(questionnaireIndex);
        }

        /* Re-validate after structural changes. */
        questionnaireGroup.updateValueAndValidity();
    }

    /* ----------------- Question mutations ----------------- */
    addQuestion(
        questionnaireIndex: number,
        incomingIndex: number | null = null,
        seed: Question | any | null = null
    ): void {
        const questionArray = this.questionArrayAt(questionnaireIndex);
        const nextIndex = incomingIndex ?? questionArray.length;
        questionArray.push(this.buildQuestionGroup(nextIndex, seed));
    }

    removeQuestion(questionnaireIndex: number, questionIndex: number): void {
        this.questionArrayAt(questionnaireIndex).removeAt(questionIndex);
    }

    addAnswer(
        questionnaireIndex: number,
        questionIndex: number,
        answerText: string | null = null
    ): void {
        this.answersArrayAt(questionnaireIndex, questionIndex).push(
            this.formBuilder.group({answer: [answerText ?? "", [Validators.required]]})
        );
    }

    removeAnswer(
        questionnaireIndex: number,
        questionIndex: number,
        answerIndex: number
    ): void {
        this.answersArrayAt(questionnaireIndex, questionIndex).removeAt(answerIndex);
    }

    addMapping(questionnaireIndex: number): void {
        this.mappingArrayAt(questionnaireIndex).push(
            this.formBuilder.group({
                label: ["", [Validators.required]],
                value: ["", [Validators.required]],
            })
        );
    }

    removeMapping(questionnaireIndex: number, mappingIndex: number): void {
        this.mappingArrayAt(questionnaireIndex).removeAt(mappingIndex);
    }

    /* ----------------------- Builders (recursive) ----------------------- */
    private buildQuestionGroup(index: number, seed: any | null): UntypedFormGroup {
        const questionGroup = this.formBuilder.group({
            index: [seed?.index ?? index],
            name: [seed?.name ?? "", [Validators.required]],
            type: [seed?.type ?? "text", [Validators.required]], /* text|number|email|mcq|list|section */
            text: [seed?.text ?? "", [Validators.required]],
            required: [seed?.required ?? false],
            detail: [seed?.detail ?? null],
            show_detail: [seed?.show_detail ?? false],
            free_text: [seed?.free_text ?? false],
            repeat: [seed?.repeat ?? false],
            times: [seed?.times ?? null],
            target: [seed?.target ?? ""],
            dependant: [seed?.dependant ?? false],
            needed: [seed?.needed ?? ""],
            answers: this.formBuilder.array([]),
            questions: this.formBuilder.array([]),
        });

        const currentType = questionGroup.get("type")?.value;

        /* Hydrate answers for mcq/list (accepts string[] or {answer}[]). */
        if (seed?.answers && (currentType === "mcq" || currentType === "list")) {
            const answersArray = questionGroup.get("answers") as UntypedFormArray;
            (seed.answers as any[]).forEach((a: any) =>
                answersArray.push(
                    this.formBuilder.group({
                        answer: [typeof a === "string" ? a : a?.answer ?? "", [Validators.required]],
                    })
                )
            );
        }

        /* Hydrate nested sub-questions recursively for section. */
        if (seed?.questions && Array.isArray(seed.questions)) {
            const childrenArray = questionGroup.get("questions") as UntypedFormArray;
            seed.questions.forEach((child: any, i: number) =>
                childrenArray.push(this.buildQuestionGroup(child?.index ?? i, child))
            );
        }

        return questionGroup;
    }

    /* ------------------------- Serialization ------------------------- */
    serializeConfiguration(): void {
        /* Clear persisted items so LocalStorage mirrors the form. */
        const questionnaireKeys = Object.keys(localStorage).filter((key) =>
            key.startsWith("questionnaire-")
        );
        questionnaireKeys.forEach((key) => this.localStorageService.removeItem(key));

        /* Deep clone current value. */
        const questionnairesValue = JSON.parse(
            JSON.stringify(this.formStep.get("questionnaires")?.value ?? [])
        );

        /* Produce required JSON structure. */
        const serialized = questionnairesValue.map((q: any, i: number) => {
            const base: any = {
                index: i + 1,
                description: q.description ?? null,
                position: q.position ?? "",
                type: q.type ?? "",
                allow_back: q.allow_back ?? false,
                questions: (q.questions ?? []).map((node: any, qi: number) =>
                    this.serializeQuestionNode(node, qi)
                ),
            };

            /* CRT: forces numeric questions, required, drops answers/mapping. */
            if (q.type === "crt") {
                base.description = null;
                base.questions = (q.questions ?? []).map((node: any, qi: number) => {
                    const crtNode = this.serializeQuestionNode(node, qi);
                    crtNode.type = "number";
                    crtNode.required = true;
                    delete crtNode.answers;
                    return crtNode;
                });
            }

            /* Likert: emits mapping and coerces questions into mcq/required. */
            if (q.type === "likert") {
                const incoming = Array.isArray(q.mapping)
                    ? q.mapping
                    : Array.isArray(q.mappings)
                        ? q.mappings
                        : [];
                base.mapping = incoming.map((m: any) => ({
                    label: m.label,
                    value: m.value,
                }));

                base.questions = (q.questions ?? []).map((node: any, qi: number) => {
                    const likertNode = this.serializeQuestionNode(node, qi);
                    likertNode.type = "mcq";
                    likertNode.required = true;
                    likertNode.free_text = false;
                    likertNode.detail = likertNode.detail ?? null;
                    likertNode.show_detail = likertNode.show_detail ?? false;
                    delete likertNode.answers;
                    return likertNode;
                });
            }

            /* Persist each questionnaire individually as before. */
            this.localStorageService.setItem(
                `questionnaire-${i}`,
                JSON.stringify(base)
            );

            return base;
        });

        this.configurationSerialized = JSON.stringify(serialized);
    }

    private serializeQuestionNode(node: any, fallbackIndex: number): any {
        const type = node.type ?? "text";
        const out: any = {
            index: node.index ?? fallbackIndex,
            name: node.name ?? "",
            type,
            text: node.text ?? "",
            required: !!node.required,
            detail: node.detail ?? null,
            show_detail: !!node.show_detail,
            free_text: !!node.free_text,
        };

        /* Optional branching/repeat fields only when meaningful. */
        if (node.repeat) out.repeat = true;
        if (node.times != null) out.times = node.times;
        if (node.target) out.target = node.target;
        if (node.dependant) out.dependant = true;
        if (node.needed) out.needed = node.needed;

        /* Answers are emitted as string[] for mcq/list. */
        if ((type === "mcq" || type === "list") && Array.isArray(node.answers)) {
            out.answers = node.answers
                .map((a: any) => (typeof a === "string" ? a : a?.answer))
                .filter((s: any) => typeof s === "string");
        }

        /* Nested questions for section type. */
        if (type === "section" && Array.isArray(node.questions)) {
            out.questions = node.questions.map((child: any, ci: number) =>
                this.serializeQuestionNode(child, ci)
            );
        }

        return out;
    }

    /* =========================
     * Cross-node VALIDATION
     * ========================= */
    private questionnaireStructureValidator = (group: UntypedFormGroup) => {
        const errors: any = {};
        const names = new Set<string>();
        const duplicates: string[] = [];
        const badDeps: string[] = [];
        const badAnswers: string[] = [];
        const emptySections: string[] = [];
        const badRepeat: string[] = [];

        /* Flatten tree to simple array of nodes (form value objects) */
        const nodes: any[] = [];
        const pushTree = (arr: any[]) => arr.forEach(n => {
            nodes.push(n);
            if (Array.isArray(n.questions)) pushTree(n.questions);
        });

        const questions = (group.get("questions") as UntypedFormArray)?.value ?? [];
        pushTree(questions);

        /* Lookup by name for dependency checks */
        const byName = new Map<string, any>();
        nodes.forEach(n => {
            if (n?.name) byName.set(n.name, n);
        });

        /* Build pre-order index so we can enforce "target must be upstream" */
        let orderCounter = 0;
        const orderByName = new Map<string, number>();
        const orderTraverse = (arr: any[]) => arr.forEach(n => {
            if (n?.name && !orderByName.has(n.name)) orderByName.set(n.name, orderCounter++);
            if (Array.isArray(n.questions)) orderTraverse(n.questions);
        });
        orderTraverse(questions);

        /* Visit each node and collect issues */
        const visit = (n: any) => {
            /* unique names */
            if (n?.name) {
                const k = n.name.trim();
                if (names.has(k)) duplicates.push(k);
                names.add(k);
            }

            /* mcq/list need ≥ 2 answers */
            if (n?.type === "mcq" || n?.type === "list") {
                const ans = (n.answers ?? [])
                    .map((a: any) => (typeof a === "string" ? a : a?.answer))
                    .filter(Boolean);
                if (ans.length < 2) badAnswers.push(n.name || "(unnamed)");
            }

            /* section must contain at least one child */
            if (n?.type === "section") {
                if (!Array.isArray(n.questions) || n.questions.length === 0) {
                    emptySections.push(n.name || "(unnamed section)");
                }
            }

            /* repeat requires positive integer times */
            if (n?.repeat) {
                const t = Number(n?.times);
                if (!Number.isInteger(t) || t < 1) badRepeat.push(n.name || "(repeater)");
            }

            /* dependant must have valid target; target must be upstream; if target is mcq/list, needed must be in answers */
            if (n?.dependant) {
                const target = byName.get(n?.target);
                if (!n?.target || !target) {
                    badDeps.push(`${n.name || "(child)"} → missing/unknown target "${n?.target}"`);
                } else {
                    const tOrd = orderByName.get(target.name);
                    const nOrd = orderByName.get(n.name);
                    if (Number.isFinite(tOrd) && Number.isFinite(nOrd) && (tOrd as number) >= (nOrd as number)) {
                        badDeps.push(`${n.name} → target "${target.name}" must be upstream (defined earlier).`);
                    }
                    if (target.type === "mcq" || target.type === "list") {
                        const ans = (target.answers ?? [])
                            .map((a: any) => (typeof a === "string" ? a : a?.answer))
                            .filter(Boolean);
                        if (!ans.includes(n?.needed)) {
                            badDeps.push(`${n.name || "(child)"} → needed="${n?.needed}" not in target "${target.name}" answers`);
                        }
                    }
                }
            }

            /* recurse */
            if (Array.isArray(n.questions)) n.questions.forEach(visit);
        };
        nodes.forEach(visit);

        /* Likert mapping check (when type is likert) */
        if (group.get("type")?.value === "likert") {
            const mapping = (group.get("mapping") as UntypedFormArray)?.value ?? [];
            const labels = new Set<string>();
            const values = new Set<string>();
            if (mapping.length < 2) errors["likertMapping"] = "Provide at least two mapping rows.";
            mapping.forEach((m: any) => {
                if (!m?.label || !m?.value) errors["likertMapping"] = "Mapping rows require both label and value.";
                const l = String(m?.label).trim();
                const v = String(m?.value).trim();
                if (labels.has(l) || values.has(v)) errors["likertMappingUnique"] = "Mapping labels/values must be unique.";
                labels.add(l);
                values.add(v);
            });
        }

        if (duplicates.length) errors["duplicateNames"] = duplicates;
        if (badDeps.length) errors["invalidDependencies"] = badDeps;
        if (badAnswers.length) errors["insufficientAnswers"] = badAnswers;
        if (emptySections.length) errors["emptySections"] = emptySections;
        if (badRepeat.length) errors["invalidRepeaters"] = badRepeat;

        return Object.keys(errors).length ? errors : null;
    };
}
