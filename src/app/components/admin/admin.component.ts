/* ============================================================================
 * AdminComponent
 * ----------------------------------------------------------------------------
 * Purpose
 *  • Minimal, robust admin console:
 *      - ACL: view ACL table rows (via GSI scan), client-side filter, paginate
 *      - DATA: query rows by identifier, client-side filter, paginate
 *      - Storage: list & delete private-bucket objects scoped to task/batch
 *      - Health: compare ACL vs hits.json and apply fixes
 *      - Generator: mounted lazily to avoid perf issues when not in use
 *
 * Notes
 *  • DEV build bypasses login.
 *  • Prefer small, deterministic, maintainable logic over cleverness here.
 *  • Tables use fixed columns for “at-a-glance” + expandable Details to show all attrs.
 * ========================================================================== */

import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    isDevMode
} from '@angular/core';
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators
} from '@angular/forms';
import {MatSnackBar} from '@angular/material/snack-bar';
import {HttpClient} from '@angular/common/http';

/* UI + utils */
import {NgxUiLoaderService} from 'ngx-ui-loader';
import CryptoES from 'crypto-es';

/* App services */
import {ConfigService} from '../../services/config.service';
import {S3Service, S3Config} from '../../services/aws/s3.service';
import {DynamoDBService} from '../../services/aws/dynamoDB.service';
import {firstValueFrom} from 'rxjs';

/* Tabs order/type */
type Panel = 'acl' | 'data' | 'storage' | 'health' | 'generator';

/* ACL and DATA list rows */
interface SimpleRow {
    id: string;                    /* stable trackBy key (unit_id / identifier+sequence / fallback) */
    raw: Record<string, any>;      /* original item as returned by DDB DocumentClient */
}

/* Pagination + filter state for a simple table */
interface SimpleTableState {
    loading: boolean;
    error?: string;
    items: SimpleRow[];            /* all fetched items */
    view: SimpleRow[];             /* filtered items (client-side) */
    lastEvaluatedKey?: any;        /* DDB paging cursor */
    filter: string;
}

/* Private bucket table state */
interface S3Row {
    id: string;
    key: string;
    size: number;
    lastModified?: string;
    storageClass?: string;
    etag?: string;
    selected: boolean;
}

interface StorageState {
    isLoading: boolean;
    error?: string;
    items: S3Row[];
    view: S3Row[];
    filter: string;
    prefix: string;                /* computed from env.taskName/env.batchName */
    sortKey?: 'key' | 'size';
    sortDir: 'asc' | 'desc' | null;
    nextToken?: string;
}

/* Health mismatch row (unchanged) */
interface MismatchRow {
    unitId: string;
    aclTokenInput: string;
    aclTokenOutput: string;
    newTokenInput: string;
    newTokenOutput: string;
    recommend: 'adopt' | 'release' | 'none';
    selected: boolean;
    rawAclItem: any;
}

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AdminComponent implements OnInit, AfterViewInit {

    /* ───────────────────────────── Login state ───────────────────────────── */

    /* PROD uses this; DEV bypasses entirely */
    loginForm: UntypedFormGroup;
    usernameControl = new UntypedFormControl('', [Validators.required]);
    passwordControl = new UntypedFormControl('', [Validators.required]);
    loginAttempted = false;
    loginGranted = false;

    /* Sidebar + content */
    activePanel: Panel = 'acl';                /* default to ACL */
    mount = {generator: false};              /* lazy-mount generator tab */
    private readonly ADMIN_LOADER_ID = 'admin';
    private authorizedAdminHashes?: Set<string>;

    /* ───────────────────────────── Health state ──────────────────────────── */

    deploymentMismatches: MismatchRow[] = [];
    isScanning = false;

    /* ───────────────────────────── ACL table ─────────────────────────────── */

    /* Fixed columns + expandable details, DDB scan via GSI, client filter */
    aclTable: SimpleTableState = {
        loading: false,
        error: undefined,
        items: [],
        view: [],
        lastEvaluatedKey: undefined,
        filter: ''
    };

    /* ───────────────────────────── DATA table ────────────────────────────── */

    dataTable: SimpleTableState & { identifierCtrl: UntypedFormControl } = {
        loading: false,
        error: undefined,
        items: [],
        view: [],
        lastEvaluatedKey: undefined,
        filter: '',
        identifierCtrl: new UntypedFormControl('')
    };

    /* ───────────────────────────── Storage table ─────────────────────────── */

    storageState: StorageState = {
        isLoading: false,
        error: undefined,
        items: [],
        view: [],
        filter: '',
        prefix: '',                 /* read-only scope; calculated on tab enter */
        sortKey: 'key',
        sortDir: 'asc',
        nextToken: undefined
    };

    /* Debounce timers for input filters (keep CD calm) */
    private aclFilterTimer: any;
    private dataFilterTimer: any;
    private storageFilterTimer: any;

    /* Expand/collapse sets for Details rows */
    expandedAcl = new Set<string>();
    expandedData = new Set<string>();

    constructor(
        private readonly cdr: ChangeDetectorRef,
        private readonly overlay: NgxUiLoaderService,
        private readonly config: ConfigService,
        private readonly s3: S3Service,
        private readonly ddb: DynamoDBService,
        private readonly configService: ConfigService,
        private readonly formBuilder: UntypedFormBuilder,
        private readonly snackbar: MatSnackBar,
        private readonly http: HttpClient
    ) {
        /* Reactive form init (prod) */
        this.loginForm = this.formBuilder.group({
            username: this.usernameControl,
            password: this.passwordControl
        });
    }

    /* ───────────────────────────── Lifecycle ─────────────────────────────── */

    ngOnInit(): void {
        /* DEV bypass: grant access immediately */
        if (isDevMode()) {
            this.loginGranted = true;
            this.loginAttempted = false;
            this.usernameControl.setValue('dev-admin');
            this.passwordControl.setValue('dev-bypass');
            this.activePanel = 'acl';
            this.showToast('Dev mode: admin unlocked (login skipped).', 3000);
            this.cdr.markForCheck();
            /* Auto-load ACL on first entry */
            this.reloadAcl();
            return;
        }
    }

    ngAfterViewInit(): void {
        /* Drain overlay if it was pre-started */
        requestAnimationFrame(() => {
            try {
                this.overlay.stopLoader(this.ADMIN_LOADER_ID);
            } catch { /* noop */
            }
        });
    }

    /* ───────────────────────────── UI helpers ────────────────────────────── */

    setActivePanel(next: Panel) {
        this.activePanel = next;

        /* Lazy-mount generator to avoid heavy initialization on initial load */
        if (next !== 'generator') this.mount.generator = false;
        if (next === 'generator') {
            Promise.resolve().then(() => {
                this.mount.generator = true;
                this.cdr.markForCheck();
            });
        }

        /* Storage: lock scope to current task/batch and load a fresh page */
        if (next === 'storage') {
            this.storageState.prefix = this.currentStoragePrefix();
            this.reloadStorage();
        }

        /* ACL: trigger first load on first visit */
        if (next === 'acl' && this.aclTable.items.length === 0 && !this.aclTable.loading) {
            this.reloadAcl();
        }

        this.cdr.markForCheck();
    }

    private showToast(message: string, durationMs: number): void {
        this.snackbar.open(message, 'Dismiss', {duration: durationMs});
    }

    /* ───────────────────────────── Auth (PROD only) ──────────────────────── */

    async verifyAdminCredentials(): Promise<void> {
        if (isDevMode()) {
            this.loginGranted = true;
            this.cdr.markForCheck();
            return;
        }
        if (!this.loginForm.valid) {
            this.showToast('Please, fill in all fields.', 4000);
            return;
        }

        this.overlay.startLoader(this.ADMIN_LOADER_ID);
        try {
            await this.ensureAdminHashesLoaded();

            const username = String(this.usernameControl.value ?? '');
            const password = String(this.passwordControl.value ?? '');
            const candidateHmac = CryptoES.HmacSHA256(`username:${username}`, password).toString();

            this.loginGranted = !!this.authorizedAdminHashes?.has(candidateHmac);
            this.loginAttempted = true;

            this.showToast(
                this.loginGranted ? `Login successful. Welcome back, ${username}.`
                    : 'Login unsuccessful. Please, review your credentials and try again.',
                5000
            );

            if (this.loginGranted) {
                this.activePanel = 'acl';
                /* Auto-load ACL right after successful login */
                this.reloadAcl();
            }
            this.cdr.markForCheck();
        } catch (error) {
            console.error('[AdminComponent] verifyAdminCredentials error:', error);
            this.showToast('Unexpected error during login. Please retry.', 6000);
        } finally {
            this.overlay.stopLoader(this.ADMIN_LOADER_ID);
        }
    }

    private async ensureAdminHashesLoaded(): Promise<void> {
        if (this.authorizedAdminHashes) return;
        try {
            const hashList = await this.s3.downloadAdministrators(this.config.environment);
            this.authorizedAdminHashes = new Set<string>(hashList ?? []);
        } catch (error) {
            console.error('[AdminComponent] Failed to load admin list:', error);
            this.authorizedAdminHashes = new Set<string>();
        }
    }

    /* ───────────────────────────── ACL (simple) ──────────────────────────── */

    async reloadAcl(): Promise<void> {
        if (!this.loginGranted || this.aclTable.loading) return;
        this.aclTable.items = [];
        this.aclTable.view = [];
        this.aclTable.lastEvaluatedKey = undefined;
        await this.loadMoreAcl();
    }

    async loadMoreAcl(): Promise<void> {
        if (!this.loginGranted || this.aclTable.loading) return;

        this.aclTable.loading = true;
        this.aclTable.error = undefined;
        this.cdr.markForCheck();

        try {
            /* Scan via unit_id-index for deterministic iteration */
            const page = await this.ddb.scanACLRecordUnitId(
                this.configService.environment,
                null,
                this.aclTable.lastEvaluatedKey ?? null,
                true
            );

            const appended = (page.Items ?? []).map((raw: any, i: number) => ({
                id: this.stableAclRowId(raw, this.aclTable.items.length + i),
                raw
            } as SimpleRow));

            this.aclTable.items = [...this.aclTable.items, ...appended];
            this.aclTable.lastEvaluatedKey = page.LastEvaluatedKey;
            this.recomputeAclView();
        } catch (err: any) {
            console.error('[Admin] ACL load error:', err);
            this.aclTable.error = err?.message || String(err);
        } finally {
            this.aclTable.loading = false;
            this.cdr.markForCheck();
        }
    }

    private stableAclRowId(item: any, idx: number): string {
        return readStr(item, 'unit_id') || readStr(item, 'identifier') || `acl-${idx}`;
    }

    onAclFilterChanged(value: string) {
        this.aclTable.filter = value || '';
        clearTimeout(this.aclFilterTimer);
        this.aclFilterTimer = setTimeout(() => {
            this.recomputeAclView();
            this.cdr.markForCheck();
        }, 80);
    }

    private recomputeAclView() {
        const needle = (this.aclTable.filter || '').trim().toLowerCase();
        const source = this.aclTable.items;
        this.aclTable.view = needle
            ? source.filter(r => JSON.stringify(r.raw).toLowerCase().includes(needle))
            : source.slice();
    }

    /* ───────────────────────────── DATA (simple) ─────────────────────────── */

    async reloadData(): Promise<void> {
        if (!this.loginGranted || this.dataTable.loading) return;
        this.dataTable.items = [];
        this.dataTable.view = [];
        this.dataTable.lastEvaluatedKey = undefined;
        await this.loadMoreData();
    }

    async loadMoreData(): Promise<void> {
        if (!this.loginGranted || this.dataTable.loading) return;

        const identifier = String(this.dataTable.identifierCtrl.value || '').trim();
        if (!identifier) {
            this.showToast('Insert identifier to query DATA.', 2500);
            return;
        }

        this.dataTable.loading = true;
        this.dataTable.error = undefined;
        this.cdr.markForCheck();

        try {
            const page = await this.ddb.getDataRecord(
                this.configService.environment,
                identifier,
                null,
                this.dataTable.lastEvaluatedKey ?? null
            );

            const appended = (page.Items ?? []).map((raw: any, i: number) => ({
                id: this.stableDataRowId(raw, this.dataTable.items.length + i),
                raw
            } as SimpleRow));

            this.dataTable.items = [...this.dataTable.items, ...appended];
            this.dataTable.lastEvaluatedKey = page.LastEvaluatedKey;
            this.recomputeDataView();
        } catch (err: any) {
            console.error('[Admin] DATA load error:', err);
            this.dataTable.error = err?.message || String(err);
        } finally {
            this.dataTable.loading = false;
            this.cdr.markForCheck();
        }
    }

    private stableDataRowId(item: any, idx: number): string {
        /* Prefer identifier+sequence; otherwise identifier; fallback to index */
        const id = readStr(item, 'identifier');
        const seq = readStr(item, 'sequence');
        return (id && seq) ? `${id}::${seq}` : (id ?? `data-${idx}`);
    }

    onDataFilterChanged(value: string) {
        this.dataTable.filter = value || '';
        clearTimeout(this.dataFilterTimer);
        this.dataFilterTimer = setTimeout(() => {
            this.recomputeDataView();
            this.cdr.markForCheck();
        }, 80);
    }

    private recomputeDataView() {
        const needle = (this.dataTable.filter || '').trim().toLowerCase();
        const source = this.dataTable.items;
        this.dataTable.view = needle
            ? source.filter(r => JSON.stringify(r.raw).toLowerCase().includes(needle))
            : source.slice();
    }

    /* Copy JSON (shared by ACL/DATA tables) */
    copyRowJson(row: { raw: any }): void {
        const text = JSON.stringify(row.raw, null, 2);
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => this.showToast('JSON copied.', 1500));
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.showToast('JSON copied.', 1500);
        }
    }

    /* Details row helpers (ACL/DATA) */
    toggleAclExpand(id: string) {
        if (this.expandedAcl.has(id)) this.expandedAcl.delete(id);
        else this.expandedAcl.add(id);
    }

    isAclExpanded(id: string): boolean {
        return this.expandedAcl.has(id);
    }

    toggleDataExpand(id: string) {
        if (this.expandedData.has(id)) this.expandedData.delete(id);
        else this.expandedData.add(id);
    }

    isDataExpanded(id: string): boolean {
        return this.expandedData.has(id);
    }

    /* Returns sorted key/value pairs for display (top-level only) */
    entriesOf(obj: any): Array<{ key: string; value: string }> {
        if (!obj || typeof obj !== 'object') return [];
        const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
        return keys.map(key => ({key, value: this.formatValue(obj[key])}));
    }

    private formatValue(v: any): string {
        if (v === undefined) return 'undefined';
        if (v === null) return 'null';
        if (typeof v === 'object') {
            try {
                return JSON.stringify(v);
            } catch {
                return String(v);
            }
        }
        return String(v);
    }

    /* ───────────────────────────── Storage (scoped) ──────────────────────── */

    private recomputeStorageView(): void {
        const s = this.storageState;
        const needle = (s.filter || '').trim().toLowerCase();

        let arr = needle ? s.items.filter(r => r.key.toLowerCase().includes(needle)) : [...s.items];

        if (s.sortKey && s.sortDir) {
            const dir = s.sortDir === 'asc' ? 1 : -1;
            const value = (r: S3Row) => (s.sortKey === 'size' ? r.size : r.key);
            arr.sort((a, b) => {
                const va = value(a) as any, vb = value(b) as any;
                return (typeof va === 'number' ? (va - vb) : String(va).localeCompare(String(vb))) * dir;
            });
        }

        s.view = arr;
    }

    onStorageFilterChanged(value: string) {
        this.storageState.filter = value;
        clearTimeout(this.storageFilterTimer);
        this.storageFilterTimer = setTimeout(() => {
            this.recomputeStorageView();
            this.cdr.markForCheck();
        }, 120);
    }

    toggleStorageSort(column: 'key' | 'size') {
        const s = this.storageState;
        if (s.sortKey !== column) {
            s.sortKey = column;
            s.sortDir = 'asc';
        } else {
            s.sortDir = s.sortDir === 'asc' ? 'desc' : (s.sortDir === 'desc' ? null : 'asc');
            if (!s.sortDir) s.sortKey = undefined;
        }
        this.recomputeStorageView();
        this.cdr.markForCheck();
    }

    storageAllSelected(): boolean {
        return this.storageState.view.length > 0 && this.storageState.view.every(r => r.selected);
    }

    storageToggleAll(checked: boolean) {
        for (const r of this.storageState.view) r.selected = checked;
    }

    storageHasSelection(): boolean {
        return this.storageState.items.some(r => r.selected);
    }

    async reloadStorage(): Promise<void> {
        /* Recompute prefix each time (task/batch may have changed) */
        this.storageState.prefix = this.currentStoragePrefix();
        this.storageState.nextToken = undefined;
        this.storageState.items = [];
        await this.loadStoragePage(true);
    }

    async loadMoreStorage(): Promise<void> {
        if (!this.storageState.nextToken && this.storageState.items.length > 0) return;
        await this.loadStoragePage(false);
    }

    private async loadStoragePage(reset: boolean): Promise<void> {
        if (this.storageState.isLoading) return;
        this.storageState.isLoading = true;
        this.storageState.error = undefined;
        this.cdr.markForCheck();

        try {
            const env = this.config.environment as S3Config;
            const res = await this.s3.listPrivateObjects(env, {
                prefix: this.storageState.prefix || '',
                continuationToken: reset ? undefined : this.storageState.nextToken,
                maxKeys: 200
            });

            const objs: S3Row[] = (res?.Contents ?? [])
                .filter((o: any) => (o?.Key || '').startsWith(this.storageState.prefix)) // hard-scope
                .map((o: any) => ({
                    id: String(o.Key),
                    key: String(o.Key),
                    size: Number(o.Size ?? 0),
                    lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : undefined,
                    storageClass: o.StorageClass,
                    etag: o.ETag,
                    selected: false
                }));

            this.storageState.items = reset ? objs : [...this.storageState.items, ...objs];
            this.storageState.nextToken = res?.NextContinuationToken;

            this.recomputeStorageView();
        } catch (err: any) {
            console.error('[AdminComponent] listPrivateObjects error:', err);
            this.storageState.error = err?.message || String(err);
            this.showToast('Listing failed. See console for details.', 4000);
        } finally {
            this.storageState.isLoading = false;
            this.cdr.markForCheck();
        }
    }

    async deleteSelectedStorage(): Promise<void> {
        const keys = this.storageState.items.filter(r => r.selected).map(r => r.key);
        if (keys.length === 0) return;

        const prefix = this.currentStoragePrefix();
        const scoped = keys.filter(k => k.startsWith(prefix));
        const skipped = keys.length - scoped.length;

        if (scoped.length === 0) {
            this.showToast('No in-scope objects to delete.', 2500);
            return;
        }

        const ok = confirm(`Delete ${scoped.length} object(s) under "${prefix}"?\nThis cannot be undone.`);
        if (!ok) return;

        this.overlay.startLoader(this.ADMIN_LOADER_ID);
        try {
            const env = this.config.environment as S3Config;
            await this.s3.deletePrivateObjects(env, scoped);
            if (skipped > 0) this.showToast(`Deleted ${scoped.length}; skipped ${skipped} out-of-scope.`, 3000);
            else this.showToast(`Deleted ${scoped.length} object(s).`, 2500);
            await this.reloadStorage();
        } catch (err) {
            console.error('[AdminComponent] deletePrivateObjects error:', err);
            this.showToast('Delete failed. See console for details.', 4000);
        } finally {
            this.overlay.stopLoader(this.ADMIN_LOADER_ID);
        }
    }

    /* Build read-only storage prefix from current env (task/batch only) */
    private currentStoragePrefix(): string {
        const env = this.config.environment as S3Config;
        const task = String(env.taskName || '').replace(/^\/|\/$/g, '');
        const batch = String(env.batchName || '').replace(/^\/|\/$/g, '');
        return batch ? `${task}/${batch}/` : (task ? `${task}/` : '');
    }

    /* ───────────────────────────── Health (unchanged core) ───────────────── */

    async scanDeploymentHealth(): Promise<void> {
        if (!this.loginGranted || this.isScanning) return;

        this.isScanning = true;
        this.deploymentMismatches = [];
        this.cdr.markForCheck();
        this.overlay.startLoader(this.ADMIN_LOADER_ID);

        try {
            const env = this.config.environment;

            /* 1) Current public IP */
            const currentPublicIp = await this.resolvePublicIp();

            /* 2) hits.json → map by unit_id */
            const hitsArray = await this.s3.downloadHits(env);
            const hitsByUnitMap = new Map<string, { tokenIn: string; tokenOut: string }>();
            for (const hit of (hitsArray ?? [])) {
                hitsByUnitMap.set(hit.unit_id, {
                    tokenIn: String(hit.token_input),
                    tokenOut: String(hit.token_output)
                });
            }

            /* 3) ACL rows for this IP (current table inferred) */
            const aclQueryResponse = await this.ddb.getACLRecordIpAddress(this.configService.environment, currentPublicIp);
            const aclItemsForIp: any[] = aclQueryResponse?.Items ?? [];

            /* 4) Compare → build rows */
            const mismatchRows: MismatchRow[] = [];
            for (const aclItem of aclItemsForIp) {
                const unitId = readStr(aclItem, 'unit_id');
                const aclTokenIn = readStr(aclItem, 'token_input');
                const aclTokenOut = readStr(aclItem, 'token_output');
                if (!unitId || !aclTokenIn || !aclTokenOut) continue;

                const freshTokens = hitsByUnitMap.get(unitId);
                if (!freshTokens) {
                    mismatchRows.push({
                        unitId,
                        aclTokenInput: aclTokenIn,
                        aclTokenOutput: aclTokenOut,
                        newTokenInput: '',
                        newTokenOutput: '',
                        recommend: 'release',
                        selected: true,
                        rawAclItem: aclItem
                    });
                } else if (freshTokens.tokenIn !== aclTokenIn || freshTokens.tokenOut !== aclTokenOut) {
                    mismatchRows.push({
                        unitId,
                        aclTokenInput: aclTokenIn,
                        aclTokenOutput: aclTokenOut,
                        newTokenInput: freshTokens.tokenIn,
                        newTokenOutput: freshTokens.tokenOut,
                        recommend: 'adopt',
                        selected: true,
                        rawAclItem: aclItem
                    });
                }
            }

            this.deploymentMismatches = mismatchRows;
            this.cdr.markForCheck();
        } catch (error) {
            console.error('[AdminComponent] scanDeploymentHealth error:', error);
            this.showToast('Scan failed. See console for details.', 5000);
        } finally {
            this.isScanning = false;
            this.overlay.stopLoader(this.ADMIN_LOADER_ID);
            this.cdr.markForCheck();
        }
    }

    async applySelectedFixes(): Promise<void> {
        if (!this.loginGranted) return;

        const selectedRows = this.deploymentMismatches.filter(r => r.selected && r.recommend !== 'none');
        if (selectedRows.length === 0) {
            this.showToast('Nothing selected.', 3000);
            return;
        }

        this.overlay.startLoader(this.ADMIN_LOADER_ID);

        let appliedOk = 0;
        let appliedFail = 0;

        try {
            for (const row of selectedRows) {
                try {
                    if (row.recommend === 'adopt') {
                        const patched = {...row.rawAclItem};
                        writeStr(patched, 'token_input', row.newTokenInput || '');
                        writeStr(patched, 'token_output', row.newTokenOutput || '');
                        await this.ddb.insertACLRecordUnitId(this.configService.environment, patched, 0, false, false);
                    } else if (row.recommend === 'release') {
                        const patched = {...row.rawAclItem};
                        writeStr(patched, 'in_progress', String(false));
                        writeStr(patched, 'time_removal', new Date().toUTCString());
                        await this.ddb.insertACLRecordUnitId(this.configService.environment, patched, 0, false, true);
                    }
                    appliedOk++;
                } catch (error) {
                    console.error('[AdminComponent] apply fix failed for', row.unitId, error);
                    appliedFail++;
                }
            }

            this.showToast(`Fixes applied: ${appliedOk} ok, ${appliedFail} failed.`, 5000);
            await this.scanDeploymentHealth();
        } finally {
            this.overlay.stopLoader(this.ADMIN_LOADER_ID);
            this.cdr.markForCheck();
        }
    }

    /* Best-effort public IP */
    private async resolvePublicIp(): Promise<string> {
        try {
            const cfTraceText = await firstValueFrom(
                this.http.get('https://1.0.0.1/cdn-cgi/trace', {responseType: 'text'})
            );
            const ipLine = (cfTraceText || '').split('\n').find(l => l.startsWith('ip='));
            const cfIp = (ipLine || '').split('=')[1]?.trim();
            if (cfIp) return cfIp;
            throw new Error('No ip in Cloudflare trace');
        } catch {
            try {
                const ipifyJson = await firstValueFrom(
                    this.http.get<{ ip: string }>('https://api64.ipify.org?format=json')
                );
                if (ipifyJson?.ip) return ipifyJson.ip;
            } catch { /* ignore */
            }
        }
        return '';
    }
}

/* ─────────────────────────── DDB marshalling helpers ─────────────────────────── */

function readStr(item: any, key: string): string | undefined {
    if (!item) return undefined;
    const value = item[key];
    if (value == null) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        if (typeof (value as any).S === 'string') return (value as any).S;
        if (typeof (value as any).N === 'string') return (value as any).N;
        if (typeof (value as any).value === 'string') return (value as any).value;
    }
    return String(value);
}

/** Always write plain JS strings; DocumentClient handles marshalling. */
function writeStr(item: any, key: string, next: string): void {
    if (!item) return;
    item[key] = next;
}
