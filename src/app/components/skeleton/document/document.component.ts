// TODO(strict-forms): auto-guarded by codemod – review if needed.

/* #################### IMPORTS #################### */

/* Angular Core */
import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
    QueryList,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import {
    UntypedFormBuilder,
    UntypedFormGroup,
} from '@angular/forms';

/* Angular Material */
import {MatStepper} from '@angular/material/stepper';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatProgressBar} from '@angular/material/progress-bar';
import {MatDialog} from '@angular/material/dialog';

/* External Libs */
import {CountdownComponent} from 'ngx-countdown';

/* Services */
import {SectionService} from '../../../services/section.service';
import {UtilsService} from '../../../services/utils.service';
import {DynamoDBService} from '../../../services/aws/dynamoDB.service';
import {ConfigService} from '../../../services/config.service';

/* Models */
import {Task} from '../../../models/skeleton/task';
import {Document} from '../../../../../data/build/skeleton/document';
import {Worker} from '../../../models/worker/worker';
import {GoldChecker} from '../../../../../data/build/skeleton/goldChecker';

/* Components */
import {DimensionComponent} from './dimension/dimension.component';
import {AnnotatorOptionsComponent} from './elements/annotator-options/annotator-options.component';
import {ElementPointwiseComponent} from './elements/element-pointwise/element-pointwise.component';
import {CountdownDialogComponent} from './countdown-dialog/countdown-dialog.component';

/* Browser API */
import {Title} from '@angular/platform-browser';

/* #################### COMPONENT #################### */

@Component({
    selector: 'app-document',
    templateUrl: './document.component.html',
    styleUrls: ['./document.component.scss'],
    standalone: false,
})
export class DocumentComponent implements OnInit, AfterViewInit, OnDestroy {

    /* #################### INPUTS #################### */

    @Input() worker!: Worker;
    @Input() documentIndex!: number;
    @Input() documentsForm!: UntypedFormGroup[];
    @Input() documentsFormsAdditional!: UntypedFormGroup[][];
    @Input() searchEngineForms!: UntypedFormGroup[][];
    @Input() resultsRetrievedForms!: Object[][];

    /* MatStepper is injected *after* content projection → use a setter */
    private _stepper?: MatStepper;
    @Input() set stepper(value: MatStepper | undefined) {
        this._stepper = value;
        if (value && this.document) {
            this.initStepperPosition();
            this.hookStepperSelection();
        }
    }

    get stepper(): MatStepper | undefined {
        return this._stepper;
    }

    /* #################### OUTPUTS #################### */

    @Output() formEmitter = new EventEmitter<object>();

    /* #################### VIEW CHILDREN #################### */

    @ViewChildren(AnnotatorOptionsComponent) annotatorOptions!: QueryList<AnnotatorOptionsComponent>;
    @ViewChildren(ElementPointwiseComponent) pointwiseComponents!: QueryList<ElementPointwiseComponent>;
    @ViewChildren(DimensionComponent) dimensionsPointwise!: QueryList<DimensionComponent>;
    @ViewChild('countdownElement') countdown!: CountdownComponent;
    @ViewChild('countdownProgressBar') countdownProgressBar!: MatProgressBar;

    /* #################### INTERNAL STATE #################### */

    task: Task;
    document!: Document;

    assessmentForm!: UntypedFormGroup;
    assessmentFormsAdditional!: UntypedFormGroup[];

    countdownInterval = 0;

    /* #################### CONSTRUCTOR #################### */

    constructor(
        private cdr: ChangeDetectorRef,
        public sectionService: SectionService,
        public utilsService: UtilsService,
        private titleService: Title,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private formBuilder: UntypedFormBuilder,
        private dynamoDBService: DynamoDBService,
        private configService: ConfigService,
        private elementRef: ElementRef
    ) {
        this.task = this.sectionService.task;
    }

    /* #################### LIFE-CYCLE #################### */

    ngOnInit(): void {
        this.document = this.task.documents[this.documentIndex];
        this.assessmentFormsAdditional = this.documentsFormsAdditional[this.documentIndex];

        /* restore flags for post-assessment */
        for (const attr of this.task.settings.attributesPost) {
            const prev = this.task.retrieveMostRecentAnswersForPostAssessment(
                this.documentIndex,
                attr.index + 1
            );
            if (Object.keys(prev).length) {
                if (attr.index === 0) {
                    this.task.initialAssessmentFormInteraction[this.documentIndex][0] = true;
                    this.task.followingAssessmentAllowed[this.documentIndex][0] = true;
                }
                this.task.initialAssessmentFormInteraction[this.documentIndex][attr.index + 1] = true;
                this.task.followingAssessmentAllowed[this.documentIndex][attr.index + 1] = true;
            }
        }

        /* now that everything is ready, finish stepper hookup if it arrived first */
        if (this.stepper && this.document) {
            this.initStepperPosition();
            this.hookStepperSelection();
        }
    }

    ngAfterViewInit(): void {
        this.startOrPromptCountdown();

        if (this.task.settings.countdown_modality && this.countdownProgressBar) {
            this.countdownProgressBar.value =
                (this.task.documentsCountdownTime[this.documentIndex] /
                    this.task.documentsStartCountdownTime[this.documentIndex]) *
                100;
        }
    }

    ngOnDestroy(): void {
        if (this.countdown) {
            this.countdown.pause();
        }
    }

    /* #################### STEPPER INITIALISATION #################### */

    private initStepperPosition(): void {
        if (!this.stepper) return;
        this.stepper.selectedIndex = this.worker.getPositionCurrent();
        this.sectionService.stepIndex = this.worker.getPositionCurrent();
        this.cdr.detectChanges();
    }

    private hookStepperSelection(): void {
        if (!this.stepper) return;
        this.stepper.selectionChange.subscribe(ev => {
            const el = this.task.getElementIndex(ev.selectedIndex);
            if (
                el.elementType === 'S' &&
                el.elementIndex === this.documentIndex &&
                this.countdown &&
                !this.task.countdownsStarted[this.documentIndex]
            ) {
                this.openCountdownDialog();
            }
        });
    }

    /* #################### COUNTDOWN HANDLING #################### */

    private startOrPromptCountdown(): void {
        const current = this.task.getElementIndex(this.worker.getPositionCurrent());
        if (
            current.elementType === 'S' &&
            current.elementIndex === this.documentIndex &&
            this.countdown
        ) {
            if (this.task.countdownsStarted[this.documentIndex]) {
                this.countdown.begin();
            } else {
                this.openCountdownDialog();
            }
        }
    }

    public handleCountdown(event: any): void {
        if (!this.task.countdownsExpired[this.documentIndex] && event.action === 'done') {
            this.task.countdownsExpired[this.documentIndex] = true;
            this.task.countdownExpiredTimestamp[this.documentIndex] = Date.now() / 1000;
            this.sendCountdownPayload(0);
            if (this.task.settings.modality === 'pointwise') {
                if (this.task.settings.annotator) {
                    this.annotatorOptions?.forEach(a => a.changeDetector.detectChanges());
                } else {
                    this.dimensionsPointwise?.forEach(d => d.changeDetector.detectChanges());
                }
            }
        }

        if (event.action === 'notify') {
            if (this.countdownProgressBar) {
                this.countdownProgressBar.value =
                    (event.left /
                        (this.task.documentsStartCountdownTime[this.documentIndex] * 1000)) *
                    100;
            }
            this.countdownInterval++;
            if (this.countdownInterval === 3) {
                this.sendCountdownPayload(event.left);
                this.countdownInterval = 0;
            }
        }
    }

    private async sendCountdownPayload(timeLeft: number): Promise<void> {
        const current = this.task.getElementIndex(this.worker.getPositionCurrent());
        const addAnswers: Record<string, any> = {};
        for (const frm of this.documentsFormsAdditional[current.elementIndex] || []) {
            Object.keys(frm.controls).forEach(ctrl => {
                addAnswers[ctrl] = frm.get(ctrl)?.value;
            });
        }
        const payload = this.task.buildTaskDocumentPayload(
            current,
            this.documentsForm[current.elementIndex].value,
            addAnswers,
            Math.round(timeLeft / 1000),
            'Update'
        );
        payload['update_type'] = 'countdown_update';
        await this.dynamoDBService.insertDataRecord(
            this.configService.environment,
            this.worker,
            this.task,
            payload,
            true
        );
    }

    private openCountdownDialog(): void {
        const ref = this.dialog.open(CountdownDialogComponent, {
            disableClose: true,
            backdropClass: 'countdown-dialog-backdrop',
            width: '450px',
            minHeight: '85%',
            data: {timeAllowed: this.task.documentsStartCountdownTime[this.documentIndex]},
        });
        ref.afterClosed().subscribe(res => {
            if (res === 'confirmed') {
                this.countdown.begin();
                this.task.countdownsStarted[this.documentIndex] = true;
            }
        });
    }

    /* #################### FORMS & ASSESSMENTS #################### */

    public storeAssessmentForm(data: any): void {
        const documentIndex = data['index'] as number;
        const form = data['form'] as UntypedFormGroup;
        const type = data['type'];

        if (type === 'initial') {
            if (!this.assessmentForm && this.documentIndex === documentIndex) {
                this.assessmentForm = this.documentsForm[this.documentIndex] || form;
                this.formEmitter.emit({form: this.assessmentForm, type});
            }
        } else {
            const postAssessmentIndex = data['postAssessmentIndex'] as number;
            if (
                !this.assessmentFormsAdditional[postAssessmentIndex - 1] &&
                this.documentIndex === documentIndex
            ) {
                this.assessmentFormsAdditional[postAssessmentIndex - 1] = form;
                this.formEmitter.emit({
                    form: this.assessmentFormsAdditional[postAssessmentIndex - 1],
                    postAssessmentIndex,
                    type,
                });
            }
        }
    }

    public handleInitialAssessmentFormInteracted(data: any): void {
        const idx = data['postAssessmentIndex'] as number;
        const allFilled = data['allValuesNotEmpty'] as boolean;
        if (allFilled) {
            this.task.initialAssessmentFormInteraction[this.documentIndex][idx] = true;
        }
    }

    public unlockNextAssessmentRepetition(data: any): void {
        const idx = data['postAssessmentIndex'] as number;
        this.task.followingAssessmentAllowed[this.documentIndex][idx] =
            data['followingAssessmentAllowed'] as boolean;
        if (idx > 0) {
            this.assessmentFormsAdditional[idx - 1].disable();
        }
    }

    public checkInitialAssessmentFormInteraction(): boolean {
        return this.task.initialAssessmentFormInteraction[this.documentIndex].every(Boolean);
    }

    public checkAssessmentFormValidity(): boolean {
        if (!this.assessmentForm) return false;
        if (this.task.settings.post_assessment) return true;
        return this.assessmentForm.valid && this.assessmentForm.status !== 'DISABLED';
    }

    public checkAdditionalAssessmentFormsValidity(): boolean {
        if (!this.assessmentFormsAdditional) return true;
        if (!this.task.settings.post_assessment) return true;
        if (this.assessmentFormsAdditional.length === 0) return false;

        return this.assessmentFormsAdditional.every((f, i, arr) =>
            i === arr.length - 1
                ? f && f.valid && f.status === 'VALID'
                : f && (f.valid || f.status === 'DISABLED')
        );
    }

    public checkFollowingAssessmentAllowed(): boolean {
        return this.task.followingAssessmentAllowed[this.documentIndex].every(Boolean);
    }

    /* #################### DOCUMENT COMPLETION #################### */

    public handleAssessmentCompletion(action: string): void {
        /* full original logic preserved ↓ */
        const goldCfg = this.document.params['check_gold'];
        const okMsg = goldCfg && typeof goldCfg['message'] === 'string';
        const okJump = goldCfg && typeof goldCfg['jump'] === 'string';

        const vids = this.elementRef.nativeElement.querySelectorAll(
            'video'
        ) as NodeListOf<HTMLVideoElement>;
        vids.forEach(v => v.pause());

        if ((action === 'Next' || action === 'Finish') && (okMsg || okJump)) {
            const docsForm = this.documentsForm.slice();
            docsForm.push(this.assessmentForm);

            const goldConfiguration = this.task.generateGoldConfiguration(
                this.task.goldDocuments,
                this.task.goldDimensions,
                docsForm,
                this.task.notes
            );
            const goldChecks = GoldChecker.performGoldCheck(
                goldConfiguration,
                this.document.params['task_type']
            );

            if (goldChecks.every(Boolean)) {
                for (let i = 0; i <= this.documentIndex; i++) {
                    this.task.showMessageFailGoldCheck[i] = null;
                }
                this.stepper!.next();
                this.sectionService.stepIndex = this.stepper!.selectedIndex;
            } else {
                if (okJump) {
                    let jumpIdx = this.task.questionnaireAmountStart;
                    for (const doc of this.task.documents) {
                        if (doc['id'] === goldCfg['jump']) {
                            jumpIdx += doc['index'];
                            if (okMsg) {
                                this.task.showMessageFailGoldCheck[doc['index']] = goldCfg['message'];
                            }
                            break;
                        }
                    }
                    this.stepper!.selectedIndex = jumpIdx;
                    this.sectionService.stepIndex = jumpIdx;
                } else if (okMsg) {
                    this.snackBar.open(goldCfg['message'], 'Dismiss', {duration: 10000});
                }
                action = 'Jump';
            }
        } else {
            if (action === 'Back') {
                this.stepper!.previous();
            } else {
                this.stepper!.next();
            }
            this.sectionService.stepIndex = this.stepper!.selectedIndex;
        }

        const newIdx = this.sectionService.stepIndex;
        const titleBase =
            this.configService.environment.taskTitle !== 'none'
                ? this.configService.environment.taskTitle
                : this.configService.environment.taskName;
        const elType = this.task.getElementIndex(newIdx)['elementType'];
        this.titleService.setTitle(`${titleBase}: ${elType}${newIdx}`);

        this.formEmitter.emit({form: this.assessmentForm, action});
    }
}
