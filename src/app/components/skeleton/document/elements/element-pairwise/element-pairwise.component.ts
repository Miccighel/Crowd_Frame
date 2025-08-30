/* #################### IMPORTS #################### */

/* Angular Core */
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

/* Services */
import { SectionService } from '../../../../../services/section.service';

/* Models */
import { Task } from '../../../../../models/skeleton/task';

/* #################### TYPES #################### */

/* Wrapper shape for child → parent emissions (kept stable) */
export interface AssessmentFormEvent {
  index: number;                        /* Document index for this form */
  form: UntypedFormGroup;               /* Reactive form instance */
  type: 'initial' | 'post';             /* Assessment phase */
  postAssessmentIndex?: number;         /* Only for 'post' phase */
}

/* #################### COMPONENT #################### */

@Component({
  selector: 'app-element-pairwise',
  templateUrl: './element-pairwise.component.html',
  styleUrls: ['./element-pairwise.component.scss', '../../document.component.scss'],
  standalone: false
})
export class ElementPairwiseComponent implements OnInit, OnChanges {

  /* ------------------------------------------------------
   * Dependencies
   * ------------------------------------------------------ */
  private readonly sectionService: SectionService;
  private readonly formBuilder: UntypedFormBuilder;

  /* One reactive form per document; each form has M boolean controls:
   *   element_0_selected, element_1_selected, ..., element_{M-1}_selected
   */
  documentSelectionForms: UntypedFormGroup[] = [];

  /* Index of the current document whose subdocuments are shown */
  @Input() documentIndex!: number;

  /* Assessment phase inputs */
  @Input() assessmentType: 'initial' | 'post' = 'initial';
  @Input() postAssessmentIndex?: number;

  /* Backing task model (source of truth for persisted selections) */
  task: Task;

  /* Upstream notification with a consistent wrapper payload */
  @Output() formEmitter: EventEmitter<AssessmentFormEvent>;

  /* Safe view-model for template (never touches Document.subdocuments type directly) */
  public subdocumentsForTemplate: any[] = [];

  constructor(
    sectionService: SectionService,
    formBuilder: UntypedFormBuilder,
  ) {
    this.sectionService = sectionService;
    this.formBuilder = formBuilder;
    this.task = this.sectionService.task;
    this.formEmitter = new EventEmitter<AssessmentFormEvent>();
  }

  /* ------------------------------------------------------
   * Validators
   * ------------------------------------------------------ */

  /* Require exactly one selected element in the group (radio-like). */
  private static validateExactlyOneSelected(group: AbstractControl): ValidationErrors | null {
    const formGroup = group as UntypedFormGroup;
    const selectedCount = Object.keys(formGroup.controls)
      .filter(controlName => controlName.endsWith('_selected'))
      .reduce((sum, controlName) => sum + (formGroup.get(controlName)?.value ? 1 : 0), 0);
    return selectedCount === 1 ? null : { exactOneRequired: true };
  }

  /* ------------------------------------------------------
   * History → form seeding (reads real payload shape)
   *  - Prefer data.answers.pairwise_selected_index when present
   *  - Fallback to element_<k>_selected flags
   *  - Enforce single selection (keep first true)
   * ------------------------------------------------------ */
  private getRestoredSelectionFromHistory(documentIndex: number, totalSubdocuments: number): boolean[] | null {
    /* Latest stored record for this document index */
    const mostRecentRecord: any = (this.task as any)?.mostRecentDataRecordsForDocuments?.[documentIndex];
    if (!mostRecentRecord) return null;

    /* Likely containers where answer-like fields might live (most specific first) */
    const possibleAnswerSources: any[] = [];
    if (mostRecentRecord.data?.answers) possibleAnswerSources.push(mostRecentRecord.data.answers);  /* real payload */
    if (mostRecentRecord.data?.form) possibleAnswerSources.push(mostRecentRecord.data.form);
    if (mostRecentRecord.answers) possibleAnswerSources.push(mostRecentRecord.answers);
    if (mostRecentRecord.form) possibleAnswerSources.push(mostRecentRecord.form);
    if (mostRecentRecord.payload?.answers) possibleAnswerSources.push(mostRecentRecord.payload.answers);
    if (mostRecentRecord.payload?.form) possibleAnswerSources.push(mostRecentRecord.payload.form);
    possibleAnswerSources.push(mostRecentRecord); /* last resort scan */

    /* Shallow merge so later sources can override earlier ones */
    const combinedAnswerFields: Record<string, unknown> = {};
    for (const source of possibleAnswerSources) {
      if (source && typeof source === 'object') Object.assign(combinedAnswerFields, source);
    }

    /* Preferred compact representation: numeric selected index (0-based) */
    const persistedSelectedIndexRaw = combinedAnswerFields['pairwise_selected_index'];
    if (persistedSelectedIndexRaw !== undefined && persistedSelectedIndexRaw !== null) {
      const persistedSelectedIndex = Number(persistedSelectedIndexRaw);
      if (Number.isInteger(persistedSelectedIndex) &&
        persistedSelectedIndex >= 0 &&
        persistedSelectedIndex < totalSubdocuments) {
        const selection = new Array<boolean>(totalSubdocuments).fill(false);
        selection[persistedSelectedIndex] = true;
        return selection;
      }
    }

    /* Fallback: reconstruct from element_<k>_selected boolean-ish flags */
    const reconstructedFlags = new Array<boolean>(totalSubdocuments).fill(false);
    let anyFlagSelected = false;

    for (let optionIndex = 0; optionIndex < totalSubdocuments; optionIndex++) {
      const selectionKey = `element_${optionIndex}_selected`;
      const rawValue = combinedAnswerFields[selectionKey];

      let isSelected = false;
      if (typeof rawValue === 'boolean') {
        isSelected = rawValue;
      } else if (typeof rawValue === 'number') {
        isSelected = rawValue === 1;
      } else if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        isSelected = (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y');
      }

      reconstructedFlags[optionIndex] = isSelected;
      anyFlagSelected = anyFlagSelected || isSelected;
    }

    if (!anyFlagSelected) return null;

    /* Enforce single selection: keep the first true, clear all others */
    const firstSelectedIndex = reconstructedFlags.findIndex(v => v);
    return reconstructedFlags.map((_, idx) => idx === firstSelectedIndex);
  }

  /* ------------------------------------------------------
   * Emission helper
   * ------------------------------------------------------ */

  private emitAssessmentEvent(documentIdx: number, selectionForm: UntypedFormGroup): void {
    const payload: AssessmentFormEvent = {
      index: documentIdx,
      form: selectionForm,
      type: this.assessmentType,
      ...(this.assessmentType === 'post' && this.postAssessmentIndex != null
        ? { postAssessmentIndex: this.postAssessmentIndex }
        : {})
    };
    this.formEmitter.emit(payload);
  }

  /* ------------------------------------------------------
   * Helpers (safe access to subdocuments)
   * ------------------------------------------------------ */

  /** Returns a safe array of subdocuments for the given document index. */
  private getSubdocuments(documentIdx: number): any[] {
    const raw = (this.task?.documents?.[documentIdx] as any)?.subdocuments;
    return Array.isArray(raw) ? raw : [];
  }

  /** Keeps `subdocumentsForTemplate` in sync with the current @Input documentIndex. */
  private refreshTemplateSubdocs(): void {
    this.subdocumentsForTemplate = this.getSubdocuments(this.documentIndex);
  }

  /* ------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------ */

  ngOnInit(): void {
    /* Prepare one selection form per document in the task */
    this.documentSelectionForms = new Array<UntypedFormGroup>(this.task.documentsAmount);

    for (let documentIdx = 0; documentIdx < this.task.documentsAmount; documentIdx++) {
      /* Number of subdocuments for this document (pairwise → typically 2) */
      const subdocumentCount = this.getSubdocuments(documentIdx).length;

      /* Ensure backing selection array exists and has the right length */
      if (!Array.isArray(this.task.documentsPairwiseSelection[documentIdx]) ||
        this.task.documentsPairwiseSelection[documentIdx].length !== subdocumentCount) {
        this.task.documentsPairwiseSelection[documentIdx] =
          Array.from({ length: subdocumentCount }, () => false);
      }

      /* Try restoring from history; fall back to existing task state */
      const restoredSelection = this.getRestoredSelectionFromHistory(documentIdx, subdocumentCount);
      const initialSelection = restoredSelection ?? this.task.documentsPairwiseSelection[documentIdx];

      /* Sync task state to whatever we will render as initial */
      this.task.documentsPairwiseSelection[documentIdx] = initialSelection.slice();

      /* Build controls dynamically from `initialSelection` */
      const controlsConfig: Record<string, UntypedFormControl> = {};
      for (let optionIdx = 0; optionIdx < subdocumentCount; optionIdx++) {
        controlsConfig[`element_${optionIdx}_selected`] = new UntypedFormControl(
          !!initialSelection[optionIdx],
          [Validators.required]  /* kept for parity; group enforces exclusivity */
        );
      }

      /* Create form with 'exact one' validator for radio-like behavior */
      const selectionForm = this.formBuilder.group(
        controlsConfig,
        { validators: ElementPairwiseComponent.validateExactlyOneSelected }
      );

      /* Keep task state in sync with form values; emit only if valid */
      selectionForm.valueChanges.subscribe(formValue => {
        for (let optionIdx = 0; optionIdx < subdocumentCount; optionIdx++) {
          this.task.documentsPairwiseSelection[documentIdx][optionIdx] =
            !!formValue[`element_${optionIdx}_selected`];
        }
        if (selectionForm.valid) {
          this.emitAssessmentEvent(documentIdx, selectionForm);
        }
      });

      /* If the restored/initial state is already valid, emit once now */
      if (selectionForm.valid) {
        this.emitAssessmentEvent(documentIdx, selectionForm);
      }

      this.documentSelectionForms[documentIdx] = selectionForm;
    }

    /* Prime the view-model for the current document */
    this.refreshTemplateSubdocs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['documentIndex']) {
      this.refreshTemplateSubdocs();
    }
  }

  /* ------------------------------------------------------
   * UI actions (exclusive selection)
   * ------------------------------------------------------ */

  /* Card click → select exactly this element (true) and clear others (false). */
  public selectElement(documentIdx: number, optionIdx: number): void {
    const selectionForm = this.documentSelectionForms[documentIdx];
    if (!selectionForm) return;

    const controlNames = Object.keys(selectionForm.controls)
      .filter(name => name.endsWith('_selected'));

    /* Build a new value map: chosen index → true, others → false */
    const exclusiveSelectionPatch: Record<string, boolean> = {};
    for (const controlName of controlNames) {
      exclusiveSelectionPatch[controlName] = (controlName === `element_${optionIdx}_selected`);
    }

    /* Triggers valueChanges → updates task + validation + parent emit (when valid) */
    selectionForm.patchValue(exclusiveSelectionPatch);
  }
}
