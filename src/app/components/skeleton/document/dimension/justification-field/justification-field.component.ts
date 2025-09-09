import {
    ChangeDetectionStrategy, ChangeDetectorRef, Component, Input,
    OnInit, OnDestroy, OnChanges, SimpleChanges
} from '@angular/core';
import {
    AbstractControl, UntypedFormGroup, ControlContainer, FormGroupDirective
} from '@angular/forms';
import {Subscription} from 'rxjs';
import {SectionService} from '../../../../../services/section.service';
import {Task} from '../../../../../models/skeleton/task';

@Component({
    selector: 'app-justification-field',
    templateUrl: './justification-field.component.html',
    styleUrls: ['./justification-field.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
    viewProviders: [{provide: ControlContainer, useExisting: FormGroupDirective}]
})
export class JustificationFieldComponent implements OnInit, OnDestroy, OnChanges {
    @Input() form!: UntypedFormGroup;
    @Input() controlName!: string;

    @Input() label!: string;
    @Input() rows = 3;
    @Input() showCounter = true;
    @Input() minWords?: number;
    @Input() surface = true;
    @Input() submitted = false;
    @Input() appearance: 'fill' | 'outline' = 'outline';

    @Input() documentIndex!: number;
    @Input() dimensionIndex!: number;
    @Input() postAssessmentIndex?: number;

    wordCount = 0;

    private valueSub?: Subscription;

    constructor(private sectionService: SectionService, private cdr: ChangeDetectorRef) {
    }

    private ctrl(): AbstractControl | null {
        return this.form?.get(this.controlName) ?? null;
    }

    /* live counter — subscribe on init and when inputs change */
    ngOnInit(): void {
        this.bindValueChanges();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['form'] || changes['controlName']) this.bindValueChanges();
    }

    ngOnDestroy(): void {
        this.valueSub?.unsubscribe();
    }

    private bindValueChanges(): void {
        this.valueSub?.unsubscribe();
        const c = this.ctrl();
        if (!c) return;
        // seed
        this.wordCount = this.countWords(c.value);
        // live updates
        this.valueSub = c.valueChanges.subscribe(v => {
            this.wordCount = this.countWords(v);
            this.cdr.markForCheck();
        });
    }

    private countWords(v: any): number {
        return String(v ?? '')
            .split(/\s+/)
            .map(w => w.trim())
            .filter(Boolean).length;
    }

    /* error helpers (unchanged semantics) */
    private shouldShow(): boolean {
        const c = this.ctrl();
        return !!(c && c.invalid && (c.touched || c.dirty || this.submitted));
    }

    showRequiredError(): boolean {
        return this.shouldShow() && !!this.ctrl()?.hasError('required');
    }

    showLongerError(): boolean {
        return this.shouldShow() && !!this.ctrl()?.hasError('longer');
    }

    showInvalidUrlError(): boolean {
        return this.shouldShow() && !!this.ctrl()?.hasError('invalid');
    }

    /* keep storage on change (not each keystroke) */
    onChange(event: any): void {
        const task: Task | undefined = this.sectionService.task;
        task?.storeDimensionValue(event, this.documentIndex, this.dimensionIndex, this.postAssessmentIndex, true);
    }
}
