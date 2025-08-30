import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    AfterViewInit,
    DestroyRef,
    inject,
    NgZone
} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {map} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

import {ConfigService} from '../../services/config.service';
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {S3Service} from '../../services/aws/s3.service';

import {BaseInstruction} from '../../models/skeleton/instructions/baseInstruction';
import {MatSnackBar} from '@angular/material/snack-bar';
import CryptoES from 'crypto-es';

@Component({
    selector: 'app-loader',
    templateUrl: './loader.component.html',
    styleUrls: ['./loader.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class LoaderComponent implements OnInit, AfterViewInit {
    /* Task metadata */
    readonly taskName: string;
    readonly batchName: string;

    instructions!: Array<BaseInstruction>;
    instructionsAmount = 0;

    /* Worker/admin attributes */
    workerIdentifier: string | null = null;
    adminAccess = false;

    /* UI control flow */
    selectionPerformed = false;
    actionChosen: 'generate' | 'perform' | null = null;
    loginPerformed = false;
    loginSuccessful = false;
    initializationCompleted = false;

    /* Forms */
    loginForm: UntypedFormGroup;
    username: UntypedFormControl;
    password: UntypedFormControl;

    /* Internals */
    private readonly LOADER_ID = 'global'; /* Global host is declared in BaseComponent */
    private adminHashes?: Set<string>;
    private readonly destroyRef = inject(DestroyRef);

    constructor(
        private readonly cdr: ChangeDetectorRef,
        private readonly ngx: NgxUiLoaderService,
        private readonly config: ConfigService,
        private readonly s3: S3Service,
        formBuilder: UntypedFormBuilder,
        private readonly snackBar: MatSnackBar,
        private readonly route: ActivatedRoute,
        private readonly zone: NgZone
    ) {
        this.taskName = this.config.environment.taskName;
        this.batchName = this.config.environment.batchName;

        this.username = new UntypedFormControl('', [Validators.required]);
        this.password = new UntypedFormControl('', [Validators.required]);
        this.loginForm = formBuilder.group({
            username: this.username,
            password: this.password
        });
    }

    ngOnInit(): void {
        this.route.queryParamMap
            .pipe(
                map(q => ({
                    workerID: q.get('workerID'),
                    admin: q.get('admin') === 'true'
                })),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(({workerID, admin}) => {
                this.workerIdentifier = workerID;
                this.adminAccess = admin;

                /* On entry, make sure the global overlay is not covering the action buttons. */
                this.drainGlobal();

                this.cdr.markForCheck();
            });
    }

    ngAfterViewInit(): void {
        /* Extra safety after first paint of this component. */
        this.stopGlobalOnNextPaint();
    }

    /* ───────────────── Actions ───────────────── */

    loadAction(action: 'generate' | 'perform'): void {
        /* Start global again while we flip to the next branch (login/skeleton). */
        this.ngx.startLoader(this.LOADER_ID);

        this.actionChosen = action;
        this.selectionPerformed = true;

        /* With OnPush, explicitly request a refresh. */
        this.cdr.markForCheck();

        /* Stop global after the new branch is rendered and painted. */
        this.stopGlobalOnNextPaint();
    }

    async performAdminCheck(): Promise<void> {
        if (!this.loginForm.valid) {
            this.showSnackbar('Please, fill in all fields.', 'Dismiss', 4000);
            return;
        }

        /* Keep admin login spinner semantics on the SAME 'global' host. */
        this.ngx.startLoader(this.LOADER_ID);
        try {
            await this.ensureAdminHashesLoaded();

            const candidate = CryptoES
                .HmacSHA256(`username:${this.username.value}`, this.password.value)
                .toString();

            this.loginSuccessful = !!this.adminHashes?.has(candidate);
            this.loginPerformed = true;

            this.showSnackbar(
                this.loginSuccessful
                    ? `Login successful. Welcome back, ${this.username.value}.`
                    : 'Login unsuccessful. Please, review your credentials and try again.',
                'Dismiss',
                5000
            );
        } catch (e) {
            console.error('[LoaderComponent] Login check failed:', e);
            this.showSnackbar('Unexpected error during login. Please retry.', 'Dismiss', 6000);
        } finally {
            this.cdr.markForCheck();
            /* Balance the login spinner start. */
            this.ngx.stopLoader(this.LOADER_ID);

            /* If the DOM flips to <app-generator> after success, ensure global is down. */
            if (this.loginSuccessful) {
                this.stopGlobalOnNextPaint();
            }
        }
    }

    /* ───────────────── Utils ───────────────── */

    private async ensureAdminHashesLoaded(): Promise<void> {
        if (this.adminHashes) return;
        try {
            const admins = await this.s3.downloadAdministrators(this.config.environment);
            this.adminHashes = new Set<string>(admins ?? []);
        } catch (e) {
            console.error('[LoaderComponent] Failed to load admin list:', e);
            this.adminHashes = new Set<string>();
        }
    }

    private showSnackbar(message: string, action: string, duration: number): void {
        this.snackBar.open(message, action, {duration});
    }

    checkFormControl(form: UntypedFormGroup, field: string, key: string): boolean {
        return !!form?.get(field)?.hasError(key);
    }

    /**
     * Stop the 'global' host after the browser has painted the current frame.
     * This avoids racing with @if branch creation under OnPush.
     */
    private stopGlobalOnNextPaint(): void {
        /* Run outside Angular to avoid triggering extra CD, then back in to stop. */
        this.zone.runOutsideAngular(() => {
            /* rAF twice => after layout & paint of the new branch. */
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.zone.run(() => this.drainGlobal());
                });
            });
        });
    }

    /**
     * Drain the 'global' loader counter safely (no stopAll(), no 'master' warnings).
     * If upstream started multiple times (route + click), a few stops zero it.
     */
    private drainGlobal(times = 4): void {
        for (let i = 0; i < times; i++) {
            try {
                this.ngx.stopLoader(this.LOADER_ID);
            } catch {
                /* Already stopped; idempotent. */
                break;
            }
        }
    }
}
