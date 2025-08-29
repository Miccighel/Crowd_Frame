import {Component, Input, OnInit} from "@angular/core";
import {
    UntypedFormArray,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from "@angular/forms";

@Component({
    selector: "app-question-item",
    templateUrl: "./question-item.component.html",
    styleUrls: ["./question-item.component.scss"],
    standalone: false,
})
export class QuestionItemComponent implements OnInit {
    @Input({required: true}) questionGroup!: UntypedFormGroup;
    @Input({required: true}) parentQuestionsArray!: UntypedFormArray;
    @Input({required: true}) parentIndex!: number;
    @Input() indentLevel = 0;
    @Input() rootQuestionsArray!: UntypedFormArray;
    @Input() path: number[] = [];

    targetOptions: Array<{ name: string; label: string; type: string; path: number[] }> = [];

    constructor(private formBuilder: UntypedFormBuilder) {
    }

    ngOnInit(): void {
        this.ensureCollectionControls();
        this.onQuestionTypeChange();
        this.bindDynamicValidators();
        this.recomputeTargetOptions();
        this.rootQuestionsArray?.valueChanges?.subscribe(() => this.recomputeTargetOptions());
    }

    questionType(): string {
        return this.questionGroup.get("type")?.value ?? "text";
    }

    answersArray(): UntypedFormArray {
        return this.questionGroup.get("answers") as UntypedFormArray;
    }

    childQuestionsArray(): UntypedFormArray {
        return this.questionGroup.get("questions") as UntypedFormArray;
    }

    addAnswerRow(): void {
        this.answersArray().push(this.formBuilder.group({answer: ["", [Validators.required]]}));
    }

    removeAnswerRow(answerIndex: number): void {
        this.answersArray().removeAt(answerIndex);
    }

    addChildQuestion(): void {
        const nextIndex = this.childQuestionsArray().length;
        this.childQuestionsArray().push(this.createEmptyQuestionGroup(nextIndex));
    }

    removeThisQuestion(): void {
        this.parentQuestionsArray.removeAt(this.parentIndex);
    }

    onQuestionTypeChange(): void {
        const currentType = this.questionType();
        if (currentType === "mcq" || currentType === "list") {
            if (this.answersArray().length === 0) this.addAnswerRow();
        } else {
            this.answersArray().clear();
        }
        const children = this.childQuestionsArray();
        if (currentType === "section" && children.length === 0) this.addChildQuestion();
    }

    private ensureCollectionControls(): void {
        if (!this.questionGroup.get("answers")) {
            this.questionGroup.addControl("answers", this.formBuilder.array([]));
        }
        if (!this.questionGroup.get("questions")) {
            this.questionGroup.addControl("questions", this.formBuilder.array([]));
        }
    }

    private createEmptyQuestionGroup(index: number): UntypedFormGroup {
        return this.formBuilder.group({
            index: [index],
            name: ["", [Validators.required]],
            type: ["text", [Validators.required]],
            text: ["", [Validators.required]],
            required: [false],
            detail: [null],
            show_detail: [false],
            free_text: [false],
            repeat: [false],
            times: [null],
            target: [""],
            dependant: [false],
            needed: [""],
            answers: this.formBuilder.array([]),
            questions: this.formBuilder.array([]),
        });
    }

    private recomputeTargetOptions(): void {
        if (!this.rootQuestionsArray) {
            this.targetOptions = [];
            return;
        }

        let order = 0;
        const items: Array<{ name: string; label: string; type: string; path: number[]; order: number }> = [];

        const traverse = (arr: UntypedFormArray, prefix: number[] = []) => {
            arr.controls.forEach((ctrl, idx) => {
                const g = ctrl as UntypedFormGroup;
                const p = [...prefix, idx];
                const name = (g.get("name")?.value ?? "").trim();
                const type = g.get("type")?.value ?? "";
                items.push({
                    name,
                    label: name ? `${name} • ${type} • ${p.join(".")}` : `(unnamed) • ${type} • ${p.join(".")}`,
                    type,
                    path: p,
                    order: order++,
                });
                const children = g.get("questions") as UntypedFormArray;
                if (Array.isArray(children?.controls)) traverse(children, p);
            });
        };

        traverse(this.rootQuestionsArray);

        const thisKey = this.path.join(".");
        const me = items.find(i => i.path.join(".") === thisKey);
        const myOrder = me?.order ?? Number.POSITIVE_INFINITY;

        const notSelfOrDescendant = (candidatePath: number[]) => {
            const candKey = candidatePath.join(".");
            return !candKey.startsWith(thisKey);
        };

        this.targetOptions = items
            .filter(i => i.name)
            .filter(i => notSelfOrDescendant(i.path))
            .filter(i => i.order < myOrder);
    }

    private bindDynamicValidators(): void {
        const repeatCtrl = this.questionGroup.get("repeat");
        const timesCtrl = this.questionGroup.get("times");
        const depCtrl = this.questionGroup.get("dependant");
        const targetCtrl = this.questionGroup.get("target");
        const neededCtrl = this.questionGroup.get("needed");

        repeatCtrl?.valueChanges.subscribe((on: boolean) => {
            if (!timesCtrl) return;
            if (on) {
                timesCtrl.setValidators([Validators.required, Validators.min(1)]);
            } else {
                timesCtrl.clearValidators();
                timesCtrl.setValue(null);
            }
            timesCtrl.updateValueAndValidity({emitEvent: false});
        });

        depCtrl?.valueChanges.subscribe((on: boolean) => {
            if (targetCtrl && neededCtrl) {
                if (on) {
                    targetCtrl.setValidators([Validators.required]);
                    neededCtrl.setValidators([Validators.required]);
                } else {
                    targetCtrl.clearValidators();
                    neededCtrl.clearValidators();
                    targetCtrl.setValue("");
                    neededCtrl.setValue("");
                }
                targetCtrl.updateValueAndValidity({emitEvent: false});
                neededCtrl.updateValueAndValidity({emitEvent: false});
            }
        });

        repeatCtrl?.updateValueAndValidity({emitEvent: true});
        depCtrl?.updateValueAndValidity({emitEvent: true});
    }
}
