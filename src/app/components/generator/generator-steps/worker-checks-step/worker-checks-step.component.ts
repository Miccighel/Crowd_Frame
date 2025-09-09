/* Core */
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges
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
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class WorkerChecksStepComponent implements OnInit, OnChanges {
    /* ---------------- Inputs / Outputs ---------------- */
    @Input() batchesTree: Array<any> = [];
    @Input() batchesTreeInitialized = false;
    @Output() formEmitter = new EventEmitter<UntypedFormGroup>();

    /* ---------------- State ---------------- */
    formStep: UntypedFormGroup;                   /* Reactive form root */
    dataStored = new WorkerSettings();            /* Last stored config (LS/S3) */
    blacklistedWorkerId = new Set<string>();      /* Chip set: blacklist */
    whitelistedWorkerId = new Set<string>();      /* Chip set: whitelist */
    readonly separatorKeysCodes = [ENTER, COMMA, SPACE] as const;
    configurationSerialized = '';

    /* map task::batch → FormArray index (stable binding) */
    private batchIndexByKey = new Map<string, number>();

    constructor(
        private localStorageService: LocalStorageService,
        private configService: ConfigService,
        private S3Service: S3Service,
        private fb: UntypedFormBuilder
    ) {
        this.formStep = this.fb.group({
            block: '',
            blacklist: '',
            whitelist: '',
            batches: this.fb.array([])
        });
    }

    /* ---------------- Lifecycle ---------------- */

    async ngOnInit() {
        const serializedWorkerChecks = this.localStorageService.getItem('worker-settings');

        if (serializedWorkerChecks) {
            this.dataStored = new WorkerSettings(JSON.parse(serializedWorkerChecks));
        } else {
            const rawWorkerChecks = await this.S3Service.downloadWorkers(this.configService.environment);
            this.dataStored = new WorkerSettings(rawWorkerChecks);
            this.localStorageService.setItem('worker-settings', JSON.stringify(rawWorkerChecks));
        }

        /* Build base form */
        this.formStep = this.fb.group({
            block: [this.dataStored.block ?? true],
            blacklist: [this.dataStored.blacklist ?? ''],
            whitelist: [this.dataStored.whitelist ?? ''],
            batches: this.fb.array([])
        });

        /* Seed chip sets */
        this.blacklistedWorkerId = new Set(this.dataStored.blacklist ?? []);
        this.whitelistedWorkerId = new Set(this.dataStored.whitelist ?? []);

        /* Build batches if already available */
        if (this.batchesTreeInitialized && this.batchesTree?.length) {
            this.rebuildFormArrayFromTree();
        }

        this.formStep.valueChanges.subscribe(() => this.serializeConfiguration());
        this.serializeConfiguration();

        this.formEmitter.emit(this.formStep);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ((changes['batchesTree'] || changes['batchesTreeInitialized'])
            && this.batchesTreeInitialized && this.batchesTree?.length) {
            this.rebuildFormArrayFromTree();
            this.serializeConfiguration();
        }
    }

    /* ---------------- Chips (blacklist / whitelist) ---------------- */

    private isValidId(id: string): boolean {
        return /^[A-Za-z0-9_-]+$/.test(id);
    }

    private normalizeId(s: string): string {
        return s.replace(/\s+/g, ' ').trim();
    }

    private ingestIdsFromString(raw: string, target: 'blacklist' | 'whitelist'): number {
        if (!raw) return 0;
        const parts = raw.split(/[,\s;]+/).map(x => this.normalizeId(x)).filter(Boolean);
        let added = 0;
        for (const id of parts) {
            if (!this.isValidId(id)) continue;
            if (target === 'blacklist') {
                const before = this.blacklistedWorkerId.size;
                this.blacklistedWorkerId.add(id);
                if (this.blacklistedWorkerId.size > before) added++;
            } else {
                const before = this.whitelistedWorkerId.size;
                this.whitelistedWorkerId.add(id);
                if (this.whitelistedWorkerId.size > before) added++;
            }
        }
        return added;
    }

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

    removeBlacklistedId(workerId: string) {
        this.blacklistedWorkerId.delete(workerId);
        this.serializeConfiguration();
    }

    removeWhitelistedId(workerId: string) {
        this.whitelistedWorkerId.delete(workerId);
        this.serializeConfiguration();
    }

    /* ---------------- Batches helpers ---------------- */

    batches(): UntypedFormArray {
        return this.formStep.get('batches') as UntypedFormArray;
    }

    private batchKey(taskNode: any, batchNode: any): string {
        return `${String(taskNode?.task ?? '')}::${String(batchNode?.batch ?? '')}`;
    }

    private buildBatchControl(_: any, batchNode: any): UntypedFormGroup {
        const initialBlacklist = !!batchNode?.['blacklist'];
        const initialWhitelist = !!batchNode?.['whitelist'];
        const initialMode: BatchMode = initialBlacklist ? 'blacklist' : (initialWhitelist ? 'whitelist' : 'none');

        return this.fb.group({
            name: batchNode?.['batch'] ?? '',
            blacklist: initialBlacklist,   /* legacy boolean */
            whitelist: initialWhitelist,   /* legacy boolean */
            mode: initialMode              /* single-select source of truth */
        });
    }

    private rebuildFormArrayFromTree(): void {
        const arr = this.batches();
        arr.clear({emitEvent: false});
        this.batchIndexByKey.clear();

        let i = 0;
        for (const task of this.batchesTree ?? []) {
            for (const batch of (task?.['batches'] ?? [])) {
                const key = this.batchKey(task, batch);
                this.batchIndexByKey.set(key, i);

                const control = this.buildBatchControl(task, batch);
                arr.push(control, {emitEvent: false});

                /* mirror 'mode' into legacy flags + persist */
                control.get('mode')!.valueChanges.subscribe((mode: BatchMode) => {
                    const isBlacklist = mode === 'blacklist';
                    const isWhitelist = mode === 'whitelist';
                    control.get('blacklist')!.setValue(isBlacklist, {emitEvent: false});
                    control.get('whitelist')!.setValue(isWhitelist, {emitEvent: false});

                    /* reflect into tree (best-effort) */
                    batch['blacklist'] = isBlacklist;
                    batch['whitelist'] = isWhitelist;

                    this.localStorageService.setItem('batches-tree', JSON.stringify(this.batchesTree));
                    this.serializeConfiguration();
                });

                i++;
            }
        }
    }

    /* stable track functions to avoid NG0956 */
    trackTask = (_: number, taskNode: any) => String(taskNode?.task ?? _);
    trackBatch = (_: number, batchNode: any) => String(batchNode?.batch ?? _);

    idxFor(taskNode: any, batchNode: any): number {
        return this.batchIndexByKey.get(this.batchKey(taskNode, batchNode)) ?? -1;
    }

    /* ---------------- JSON serialization ---------------- */

    private serializeConfiguration() {
        const configurationRaw = JSON.parse(JSON.stringify(this.formStep.value));

        const blacklistClean = Array.from(this.blacklistedWorkerId.values()).filter(id => this.isValidId(id)).sort();
        const whitelistClean = Array.from(this.whitelistedWorkerId.values()).filter(id => this.isValidId(id)).sort();

        configurationRaw.blacklist = blacklistClean;
        configurationRaw.whitelist = whitelistClean;

        const blacklist_batches: string[] = [];
        const whitelist_batches: string[] = [];

        for (const batch of configurationRaw.batches ?? []) {
            const mode: BatchMode = (batch.mode as BatchMode) ?? 'none';
            const isBlacklist = mode === 'blacklist' || (!!batch.blacklist && !batch.whitelist);
            const isWhitelist = mode === 'whitelist' || (!!batch.whitelist && !batch.blacklist);
            if (isBlacklist) blacklist_batches.push(batch.name);
            if (isWhitelist) whitelist_batches.push(batch.name);
        }

        blacklist_batches.sort();
        whitelist_batches.sort();

        configurationRaw['blacklist_batches'] = blacklist_batches;
        configurationRaw['whitelist_batches'] = whitelist_batches;

        this.localStorageService.setItem('worker-settings', JSON.stringify(configurationRaw));

        delete configurationRaw['batches'];
        this.configurationSerialized = JSON.stringify(configurationRaw);
    }
}
