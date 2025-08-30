/* Core */
import {
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output
} from '@angular/core';
import {
    UntypedFormArray,
    UntypedFormBuilder,
    UntypedFormGroup
} from '@angular/forms';
import {MatChipInputEvent} from '@angular/material/chips';
import {COMMA, ENTER, SPACE} from '@angular/cdk/keycodes';

/* Services */
import {LocalStorageService} from '../../../../services/localStorage.service';
import {ConfigService} from '../../../../services/config.service';
import {S3Service} from '../../../../services/aws/s3.service';

/* Models */
import {WorkerSettings} from '../../../../models/worker/workerSettings';

/* Single-select batch mode */
type BatchMode = 'none' | 'blacklist' | 'whitelist';

@Component({
    selector: 'app-worker-checks',
    templateUrl: './worker-checks-step.component.html',
    styleUrls: ['../../generator.component.scss'],
    standalone: false
})
export class WorkerChecksStepComponent implements OnInit {
    /* ---------------- Inputs / Outputs ---------------- */
    @Input() batchesTree: Array<any> = [];
    @Input() batchesTreeInitialized: boolean;
    @Output() formEmitter: EventEmitter<UntypedFormGroup>;

    /* ---------------- State ---------------- */
    formStep: UntypedFormGroup;                   /* Reactive form root */
    dataStored = new WorkerSettings();            /* Last stored config (LS/S3) */
    blacklistedWorkerId: Set<string>;             /* Chip set: blacklist */
    whitelistedWorkerId: Set<string>;             /* Chip set: whitelist */
    readonly separatorKeysCodes = [ENTER, COMMA, SPACE] as const; /* Token separators */
    configurationSerialized: string;              /* Compact JSON preview */

    /* ---------------- DI ---------------- */
    constructor(
        private localStorageService: LocalStorageService,
        private configService: ConfigService,
        private S3Service: S3Service,
        private _formBuilder: UntypedFormBuilder
    ) {
        this.initializeControls();
    }

    /* ----------------------------------------------------
     * Init helpers
     * ---------------------------------------------------- */

    /* Initialize empty form and emitter */
    private initializeControls() {
        this.dataStored = new WorkerSettings();
        this.formStep = this._formBuilder.group({
            block: '',
            blacklist: '',
            whitelist: '',
            batches: this._formBuilder.array([])
        });
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    /* On component init, restore settings from LS (fallback S3) and build form */
    async ngOnInit() {
        const serializedWorkerChecks =
            this.localStorageService.getItem('worker-settings');

        if (serializedWorkerChecks) {
            this.dataStored = new WorkerSettings(JSON.parse(serializedWorkerChecks));
        } else {
            this.initializeControls();
            const rawWorkerChecks = await this.S3Service.downloadWorkers(
                this.configService.environment
            );
            this.dataStored = new WorkerSettings(rawWorkerChecks);
            this.localStorageService.setItem(
                `worker-settings`,
                JSON.stringify(rawWorkerChecks)
            );
        }

        /* Build form from stored data */
        this.formStep = this._formBuilder.group({
            block: [this.dataStored.block ?? true],
            blacklist: [this.dataStored.blacklist ?? ''],
            whitelist: [this.dataStored.whitelist ?? ''],
            batches: this._formBuilder.array([])
        });

        /* Initialize chip sets from stored lists */
        this.whitelistedWorkerId = new Set();
        this.blacklistedWorkerId = new Set();
        this.dataStored.blacklist?.forEach((id: string) =>
            this.blacklistedWorkerId.add(id)
        );
        this.dataStored.whitelist?.forEach((id: string) =>
            this.whitelistedWorkerId.add(id)
        );

        /* ---- Assign a stable index ('counter') matching the FormArray position ---- */
        let idx = 0;
        for (const taskNode of this.batchesTree ?? []) {
            for (const batchNode of taskNode['batches'] ?? []) {
                batchNode['counter'] = idx; // used by [formGroupName] in template
                this.addBatch(batchNode);   // pushes the control in the same order
                idx++;
            }
        }

        /* Persist any change */
        this.formStep.valueChanges.subscribe(() => this.serializeConfiguration());
        this.serializeConfiguration();

        /* Emit form to parent */
        this.formEmitter.emit(this.formStep);
    }

    /* ----------------------------------------------------
     * Chip input helpers (blacklist / whitelist)
     * ---------------------------------------------------- */

    /* Validate worker ID: only alphanumeric, dash, underscore */
    private isValidId(id: string): boolean {
        return /^[A-Za-z0-9_-]+$/.test(id);
    }

    /* Normalize ID: trim + collapse inner whitespace */
    private normalizeId(s: string): string {
        return s.replace(/\s+/g, ' ').trim();
    }

    /* Ingest possibly multiple IDs from a raw string (paste/blur/typed) */
    private ingestIdsFromString(
        raw: string,
        target: 'blacklist' | 'whitelist'
    ): number {
        if (!raw) return 0;
        const parts = raw
            .split(/[,\s;]+/)
            .map((x) => this.normalizeId(x))
            .filter(Boolean);
        let added = 0;
        for (const id of parts) {
            if (!this.isValidId(id)) continue; /* skip invalids */
            if (target === 'blacklist') {
                const size = this.blacklistedWorkerId.size;
                this.blacklistedWorkerId.add(id);
                if (this.blacklistedWorkerId.size > size) added++;
            } else {
                const size = this.whitelistedWorkerId.size;
                this.whitelistedWorkerId.add(id);
                if (this.whitelistedWorkerId.size > size) added++;
            }
        }
        return added;
    }

    /* Chip add handlers (wired in template) */
    addBlacklistedId(event: MatChipInputEvent) {
        const raw = (event.value || '').trim();
        if (raw) {
            this.ingestIdsFromString(raw, 'blacklist');
            event.chipInput?.clear();
            this.serializeConfiguration();
        }
    }

    addWhitelistedId(event: MatChipInputEvent) {
        const raw = (event.value || '').trim();
        if (raw) {
            this.ingestIdsFromString(raw, 'whitelist');
            event.chipInput?.clear();
            this.serializeConfiguration();
        }
    }

    /* Chip remove handlers */
    removeBlacklistedId(workerId: string) {
        this.blacklistedWorkerId.delete(workerId);
        this.serializeConfiguration();
    }

    removeWhitelistedId(workerId: string) {
        this.whitelistedWorkerId.delete(workerId);
        this.serializeConfiguration();
    }

    /* ----------------------------------------------------
     * Batches helpers (single-select chip listbox)
     * ---------------------------------------------------- */

    batches(): UntypedFormArray {
        return this.formStep.get('batches') as UntypedFormArray;
    }

    private batchControlAt(index: number): UntypedFormGroup | null {
        return (this.batches()?.at(index) as UntypedFormGroup) ?? null;
    }

    /* Create a batch form group; keep legacy booleans and add "mode" */
    addBatch(batchNode: any) {
        const initialBlacklist = !!batchNode?.['blacklist'];
        const initialWhitelist = !!batchNode?.['whitelist'];
        const initialMode: BatchMode = initialBlacklist
            ? 'blacklist'
            : initialWhitelist
                ? 'whitelist'
                : 'none';

        const control = this._formBuilder.group({
            name: batchNode?.['batch'] ?? '',
            counter:
                typeof batchNode?.['counter'] === 'number'
                    ? batchNode['counter']
                    : this.batches().length, // fallback: current length
            blacklist: initialBlacklist,   /* legacy boolean */
            whitelist: initialWhitelist,   /* legacy boolean */
            mode: initialMode              /* single-select source of truth */
        });

        this.batches().push(control, {emitEvent: false});

        /* Mirror chip listbox selection (mode) into legacy flags and batchesTree */
        const idx = control.get('counter')!.value as number;

        control.get('mode')!.valueChanges.subscribe((mode: BatchMode) => {
            this.setBatchMode(idx, mode ?? 'none');
        });

        /* Ensure initial sync for this batch */
        this.setBatchMode(idx, initialMode);
    }

    /* Getter used previously by template; safe to keep if needed elsewhere */
    getBatchMode(batchIndex: number): BatchMode {
        const batch = this.batchControlAt(batchIndex);
        return (batch?.get('mode')?.value as BatchMode) ?? 'none';
    }

    /* Setter for listbox: mirror mode → legacy booleans, sync tree, persist */
    setBatchMode(batchIndex: number, mode: BatchMode) {
        const batch = this.batchControlAt(batchIndex);
        if (!batch) return;

        batch.get('mode')?.setValue(mode, {emitEvent: false});

        const isBlacklist = mode === 'blacklist';
        const isWhitelist = mode === 'whitelist';
        batch.get('blacklist')?.setValue(isBlacklist, {emitEvent: false});
        batch.get('whitelist')?.setValue(isWhitelist, {emitEvent: false});

        /* Reflect change into batchesTree for UI model sync */
        const name = batch.get('name')?.value;
        this.batchesTree?.forEach((taskNode: any, tIdx: number) => {
            (taskNode['batches'] ?? []).forEach((node: any, bIdx: number) => {
                if (node?.['batch'] === name) {
                    this.batchesTree[tIdx]['batches'][bIdx]['blacklist'] = isBlacklist;
                    this.batchesTree[tIdx]['batches'][bIdx]['whitelist'] = isWhitelist;
                }
            });
        });

        this.localStorageService.setItem(
            'batches-tree',
            JSON.stringify(this.batchesTree)
        );
        this.serializeConfiguration();
    }

    /* ----------------------------------------------------
     * JSON output serialization (with validation)
     * ---------------------------------------------------- */
    private serializeConfiguration() {
        /* Start from raw form value to include batch structure */
        const configurationRaw = JSON.parse(JSON.stringify(this.formStep.value));

        /* Sanitize chip sets: keep only valid IDs and sort for determinism */
        const blacklistClean = Array.from(this.blacklistedWorkerId.values()).filter(
            (id) => this.isValidId(id)
        );
        const whitelistClean = Array.from(this.whitelistedWorkerId.values()).filter(
            (id) => this.isValidId(id)
        );
        blacklistClean.sort();
        whitelistClean.sort();

        configurationRaw.blacklist = blacklistClean;
        configurationRaw.whitelist = whitelistClean;

        /* Compute batch lists from the single-select 'mode' (fallback to legacy booleans) */
        const blacklist_batches: string[] = [];
        const whitelist_batches: string[] = [];

        for (const batch of configurationRaw.batches ?? []) {
            const mode: BatchMode = (batch.mode as BatchMode) ?? 'none';
            const isBlacklist =
                mode === 'blacklist' || (!!batch.blacklist && !batch.whitelist);
            const isWhitelist =
                mode === 'whitelist' || (!!batch.whitelist && !batch.blacklist);
            if (isBlacklist) blacklist_batches.push(batch.name);
            if (isWhitelist) whitelist_batches.push(batch.name);
        }

        /* Sort batch names for stable output */
        blacklist_batches.sort();
        whitelist_batches.sort();

        configurationRaw['blacklist_batches'] = blacklist_batches;
        configurationRaw['whitelist_batches'] = whitelist_batches;

        /* Persist full config (with batches) to local storage */
        this.localStorageService.setItem(
            `worker-settings`,
            JSON.stringify(configurationRaw)
        );

        /* Expose compact JSON (without batches) for preview or upstream use */
        delete configurationRaw['batches'];
        this.configurationSerialized = JSON.stringify(configurationRaw);
    }
}
