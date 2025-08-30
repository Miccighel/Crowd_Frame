import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    OnInit,
    Output,
    DestroyRef,
    inject
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    map,
    of,
    switchMap,
    from
} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

import {Task} from '../../models/skeleton/task';
import {TaskSettings} from '../../models/skeleton/taskSettings';
import {SearchEngineSettings} from '../../models/searchEngine/searchEngineSettings';
import {SectionService} from '../../services/section.service';
import {ConfigService} from '../../services/config.service';
import {S3Service} from '../../services/aws/s3.service';
import {NgxUiLoaderService} from 'ngx-ui-loader';

@Component({
    selector: 'app-base',
    templateUrl: './base.component.html',
    styleUrls: ['./base.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class BaseComponent implements OnInit {
    /* Lean, typed state */
    currentComponent: 'loader' | 'result-summary' = 'loader';
    resultUUID?: string;

    /* Shared Task instance */
    task: Task;

    @Output() initializationCompleted = new EventEmitter<boolean>();

    /* Valid inject context for DestroyRef */
    private readonly destroyRef = inject(DestroyRef);

    /* Single global loader id used across the app */
    private readonly LOADER_ID = 'global';

    constructor(
        private readonly route: ActivatedRoute,
        public readonly sectionService: SectionService,
        private readonly configService: ConfigService,
        private readonly s3: S3Service,
        private readonly cdr: ChangeDetectorRef,
        private readonly ngx: NgxUiLoaderService
    ) {
        this.sectionService.task = new Task();
        this.task = this.sectionService.task;
    }

    ngOnInit(): void {
        this.route.queryParamMap.pipe(
            debounceTime(10),
            map(q => q.get('result-summary') || null),
            distinctUntilChanged(),
            switchMap((summaryId) => {
                if (summaryId) {
                    /* Result Summary branch */
                    this.currentComponent = 'result-summary';
                    this.resultUUID = summaryId;
                    this.cdr.markForCheck();
                    return of(null);
                } else {
                    /* Loader branch */
                    this.currentComponent = 'loader';
                    this.resultUUID = undefined;
                    this.cdr.markForCheck();

                    /* Show global overlay while fetching config/settings.
                       SkeletonComponent will stop this loader when the UI is ready. */
                    this.ngx.startLoader(this.LOADER_ID);
                    return from(this.fetchData());
                }
            }),
            catchError(err => {
                console.error('[BaseComponent] Initialization error:', err);
                return of(null);
            }),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(() => {
            this.initializationCompleted.emit(true);
            this.cdr.markForCheck();
        });
    }

    private fetchData(): Promise<void> {
        const env = this.configService.environment;
        this.task.taskName = env.taskName;
        this.task.batchName = env.batchName;

        return Promise.all([
            this.s3.downloadTaskSettings(env),
            this.s3.downloadGeneralInstructions(env),
            this.s3.downloadSearchEngineSettings(env)
        ]).then(([taskSettings, generalInstructions, searchEngineSettings]) => {
            this.task.settings = new TaskSettings(taskSettings);
            this.task.initializeInstructionsGeneral(generalInstructions);
            this.task.searchEngineSettings = new SearchEngineSettings(searchEngineSettings);
        });
    }
}
