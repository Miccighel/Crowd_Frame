/* ------------------------------------------------------
   Core Angular
   ------------------------------------------------------ */
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';

/* ------------------------------------------------------
   Services & Models
   ------------------------------------------------------ */
import { SectionService, StatusCodes } from '../../../services/section.service';
import { ConfigService } from '../../../services/config.service';
import { UtilsService } from '../../../services/utils.service';
import { Worker } from '../../../models/worker/worker';

/* ------------------------------------------------------
   Local types
   ------------------------------------------------------ */
/** String discriminator used in the template. */
type StatusKey =
  | 'IP_INFORMATION_MISSING'
  | 'TASK_SUCCESSFUL'
  | 'TASK_ALREADY_COMPLETED'
  | 'TASK_FAILED_WITH_TRIES'
  | 'TASK_FAILED_NO_TRIES'
  | 'TASK_OVERBOOKING'
  | 'TASK_TIME_EXPIRED'
  | 'TASK_COMPLETED_BY_OTHERS'
  | 'WORKER_RETURNING_BLOCK'
  | 'WORKER_BLACKLIST_CURRENT'
  | 'WORKER_BLACKLIST_PREVIOUS'
  | 'WORKER_WHITELIST_PREVIOUS'
  | 'CODE_UNKNOWN';

/**
 * OutcomeSectionComponent
 * =======================
 * Renders the post-task outcome UI (title, description, submission steps, comment box).
 *
 * Key refactors:
 * - Platform is read from environment (ConfigService.environment.platform).
 * - Remaining tries are derived from inputs (triesAllowed - tryCurrent).
 * - Template compares against a string key (StatusKey) for maximal TS safety.
 */
@Component({
  selector: 'app-outcome-section',
  templateUrl: './outcome-section.component.html',
  styleUrls: ['./outcome-section.component.scss'],
  standalone: false,
})
export class OutcomeSectionComponent implements OnInit {

  /* ------------------------------------------------------
     Form & UI state
     ------------------------------------------------------ */
  /** Final comment form reference. */
  public commentForm: UntypedFormGroup;

  /** Flag to disable the comment UI after a successful send. */
  public commentSent = false;

  /** Minimum number of words required in the comment text. */
  public readonly wordsRequired = 5;

  /* ------------------------------------------------------
     Inputs (from parent)
     ------------------------------------------------------ */
  /** Current worker context (used for status_code + pretty time helpers). */
  @Input() worker!: Worker;

  /** Max allowed tries for the assignment. */
  @Input() triesAllowed = 0;

  /** Current try index. */
  @Input() tryCurrent = 0;

  /** Optional extra messages to show. */
  @Input() messages: string[] = [];

  /** Submission tokens (source of truth lives in parent). */
  @Input() tokenInput = '';
  @Input() tokenOutput = '';

  /* ------------------------------------------------------
     Outputs (to parent)
     ------------------------------------------------------ */
  /** Emits when user requests a reset after failed checks. */
  @Output() performReset = new EventEmitter<boolean>();

  /** Emits when a valid comment should be persisted by the parent. */
  @Output() commentEmitter = new EventEmitter<string>();

  /* ------------------------------------------------------
     Constructor & lifecycle
     ------------------------------------------------------ */
  constructor(
    private readonly formBuilder: UntypedFormBuilder,
    private readonly sectionService: SectionService,
    public readonly utilsService: UtilsService,
    private readonly configService: ConfigService
  ) {
    /* Build the comment form with custom validator */
    this.commentForm = this.formBuilder.group({
      comment: new UntypedFormControl('', [this.validateComment.bind(this)]),
    });
  }

  ngOnInit(): void {
    /* Keep existing behavior: mark current section */
    this.sectionService.updateSection();
  }

  /* ------------------------------------------------------
     Derived state for template
     ------------------------------------------------------ */

  /**
   * Platform is environment-driven, never read from worker.
   * Defaults to 'custom' if not configured.
   */
  get platform(): 'mturk' | 'toloka' | 'prolific' | 'custom' {
    return (this.configService?.environment?.platform ?? 'custom') as
      'mturk' | 'toloka' | 'prolific' | 'custom';
  }

  /**
   * String key for the current status.
   * Works regardless of whether StatusCodes is numeric or string-based.
   */
  get statusKey(): StatusKey {
    const raw = this.worker?.getParameter?.('status_code');

    // 1) Exact match if worker already provides the enum key as string
    if (typeof raw === 'string') {
      // Normalize to our union if possible
      if (raw in (StatusCodes as any)) return raw as StatusKey;

      // Otherwise, try to map by value equality (e.g., worker sends "3", enum holds 3)
      const numeric = Number(raw);
      const byValue = this.findStatusKeyByValue(Number.isFinite(numeric) ? numeric : raw);
      if (byValue) return byValue;
    }

    // 2) Match by value (number or string) against whatever StatusCodes holds
    if (typeof raw === 'number') {
      const byValue = this.findStatusKeyByValue(raw);
      if (byValue) return byValue;
    }

    // 3) Fallback
    return 'CODE_UNKNOWN';
  }

  /**
   * What to display as the raw status code for support messages.
   * (Keeps the original worker-provided value where possible.)
   */
  get statusCodeDisplay(): string {
    const raw = this.worker?.getParameter?.('status_code');
    return raw !== undefined && raw !== null ? String(raw) : 'CODE_UNKNOWN';
  }

  /**
   * Remaining tries computed from inputs.
   * Clamped to avoid negative values.
   */
  get triesLeft(): number {
    const allowed = Number(this.triesAllowed) || 0;
    const current = Number(this.tryCurrent) || 0;
    return Math.max(0, allowed - current);
  }

  /* ------------------------------------------------------
     Actions
     ------------------------------------------------------ */

  /**
   * Prolific completion: open the completion URL with the configured code.
   */
  public completeTask(): void {
    const code = this.configService?.environment?.prolific_completion_code;
    if (!code) return;
    window.open(`https://app.prolific.com/submissions/complete?cc=${code}`, '_blank');
  }

  /**
   * Validate and emit the user comment; disable input after send.
   */
  public performCommentSaving(): void {
    const ctrl = this.commentForm.get('comment');
    if (ctrl?.valid) {
      this.commentEmitter.emit(ctrl.value);
      this.commentSent = true;
    }
    ctrl?.markAsTouched();
  }

  /* ------------------------------------------------------
     Validation helpers
     ------------------------------------------------------ */

  /** Custom validator: require at least `wordsRequired` non-empty tokens. */
  public validateComment(control: UntypedFormControl) {
    const count = this.countWords(control?.value);
    return count < this.wordsRequired ? { required: true } : null;
  }

  /** Count non-empty whitespace-separated tokens in a string. */
  private countWords(value: unknown): number {
    if (typeof value !== 'string') return 0;
    return value.trim().split(/\s+/).filter(Boolean).length;
  }

  /* ------------------------------------------------------
     Internal mapping helpers
     ------------------------------------------------------ */

  /**
   * Try to recover the StatusKey by comparing the worker-provided value
   * to the values stored in StatusCodes (numeric or string).
   */
  private findStatusKeyByValue(value: unknown): StatusKey | null {
    const obj = StatusCodes as any;
    for (const k of Object.keys(obj)) {
      if (obj[k] === value || String(obj[k]) === String(value)) {
        return k as StatusKey;
      }
    }
    return null;
  }
}
