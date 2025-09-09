/* ============================================================================
 * AdminComponent
 * ----------------------------------------------------------------------------
 * Relative comments:
 * • In DEV (isDevMode() === true), we bypass the login gate and show the
 *   admin workspace immediately. No env vars or query params required.
 * • In PROD, the usual HMAC(username, password) check against admin.json applies.
 * • Local overlay host (loaderId: 'admin') keeps this separate from global.
 * • Left-rail navigation toggles a simple 'activePanel' string (no MatTabs).
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

import {NgxUiLoaderService} from 'ngx-ui-loader';
import CryptoES from 'crypto-es';

import {ConfigService} from '../../services/config.service';
import {S3Service} from '../../services/aws/s3.service';
import {DynamoDBService} from '../../services/aws/dynamoDB.service';
import {firstValueFrom} from 'rxjs';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AdminComponent implements OnInit, AfterViewInit {

    /* ───────── Login form/state (kept for PROD; hidden in DEV bypass) ───────── */
    loginForm: UntypedFormGroup;
    usernameControl = new UntypedFormControl('', [Validators.required]);
    passwordControl = new UntypedFormControl('', [Validators.required]);
    loginAttempted = false;
    loginGranted = false;

    /* Current admin view – replaces old mat-tab usage ('generator' | 'health') */
    activePanel: 'generator' | 'health' = 'generator';

    /* Local overlay id (separate from global overlay) */
    private readonly ADMIN_LOADER_ID = 'admin';

    /* Cached admin HMAC list (PROD login only) */
    private authorizedAdminHashes?: Set<string>;

    /* Deployment-health state */
    deploymentMismatches: MismatchRow[] = [];
    isScanning = false;

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
        /* Reactive login form */
        this.loginForm = this.formBuilder.group({
            username: this.usernameControl,
            password: this.passwordControl
        });
    }

    /* ───────── Lifecycle ───────── */

    ngOnInit(): void {
        /* DEV bypass: skip login entirely and reveal admin tools immediately */
        if (isDevMode()) {
            this.loginGranted = true;
            this.loginAttempted = false;
            this.usernameControl.setValue('dev-admin');
            this.passwordControl.setValue('dev-bypass');
            /* Start in generator; flip to 'health' if you mostly test the scan view */
            this.activePanel = 'generator';
            this.showToast('Dev mode: admin unlocked (login skipped).', 3000);
            this.cdr.markForCheck();
            return;
        }
        /* PROD: user will authenticate via verifyAdminCredentials() */
    }

    ngAfterViewInit(): void {
        /* Drain any pre-started local overlay after first paint */
        requestAnimationFrame(() => {
            try {
                this.overlay.stopLoader(this.ADMIN_LOADER_ID);
            } catch { /* already stopped */
            }
        });
    }

    /* ───────── Login flow (PROD only) ───────── */

    async verifyAdminCredentials(): Promise<void> {
        if (isDevMode()) {
            /* In DEV, button is irrelevant but keep it graceful */
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

            const candidateHmac = CryptoES
                .HmacSHA256(`username:${username}`, password)
                .toString();

            this.loginGranted = !!this.authorizedAdminHashes?.has(candidateHmac);
            this.loginAttempted = true;

            this.showToast(
                this.loginGranted
                    ? `Login successful. Welcome back, ${username}.`
                    : 'Login unsuccessful. Please, review your credentials and try again.',
                5000
            );

            /* After login, default to generator panel (or switch to 'health' if preferred) */
            if (this.loginGranted) {
                this.activePanel = 'generator';
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

    /* Template helper for <mat-error> bindings (used in PROD) */
    public checkFormControl(form: UntypedFormGroup, fieldName: string, errorKey: string): boolean {
        return !!form?.get(fieldName)?.hasError(errorKey);
    }

    private showToast(message: string, durationMs: number): void {
        this.snackbar.open(message, 'Dismiss', {duration: durationMs});
    }

    /* ───────── Deployment health: SCAN ───────── */

    async scanDeploymentHealth(): Promise<void> {
        /* Guard: require login and avoid parallel scans */
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
                    /* Unit no longer exists in hits.json → recommend release */
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
                    /* Tokens differ → recommend adopt (align ACL with hits.json) */
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

    /* ───────── Deployment health: APPLY FIXES ───────── */

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
                        /* Update ACL tokens to match hits.json */
                        const patchedItem = {...row.rawAclItem};
                        writeStr(patchedItem, 'token_input', row.newTokenInput || '');
                        writeStr(patchedItem, 'token_output', row.newTokenOutput || '');
                        await this.ddb.insertACLRecordUnitId(this.configService.environment, patchedItem, 0, false, false);
                    } else if (row.recommend === 'release') {
                        /* Free slot (mark not in progress) + bump removal time */
                        const patchedItem = {...row.rawAclItem};
                        writeStr(patchedItem, 'in_progress', String(false));
                        writeStr(patchedItem, 'time_removal', new Date().toUTCString());
                        await this.ddb.insertACLRecordUnitId(this.configService.environment, patchedItem, 0, false, true);
                    }
                    appliedOk++;
                } catch (error) {
                    console.error('[AdminComponent] apply fix failed for', row.unitId, error);
                    appliedFail++;
                }
            }

            this.showToast(`Fixes applied: ${appliedOk} ok, ${appliedFail} failed.`, 5000);

            /* Refresh table content */
            await this.scanDeploymentHealth();
        } finally {
            this.overlay.stopLoader(this.ADMIN_LOADER_ID);
            this.cdr.markForCheck();
        }
    }

    /* ───────── Public IP resolution (best-effort) ───────── */

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

/* ───────── Dynamo marshalling helpers ───────── */

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

/* ───────── View model for mismatches ───────── */

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
