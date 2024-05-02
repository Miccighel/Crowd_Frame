import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { TaskSettings } from "../../models/skeleton/taskSettings";
import { SearchEngineSettings } from "../../models/searchEngine/searchEngineSettings";
import { SectionService } from "../../services/section.service";
import { ConfigService } from "../../services/config.service";
import { S3Service } from "../../services/aws/s3.service";
import { ActivatedRoute } from "@angular/router";
import { Subscription, catchError, tap, switchMap, of, distinctUntilChanged, debounceTime } from 'rxjs';
import {Task} from "../../models/skeleton/task";

@Component({
    selector: 'app-base',
    templateUrl: './base.component.html',
    styleUrls: ['./base.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BaseComponent implements OnInit, OnDestroy {
    currentComponent;
    private subscriptions: Subscription = new Subscription();
    task: Task;
    resultUUID: string;
    @Output() initializationCompleted = new EventEmitter<boolean>();

    constructor(
        private route: ActivatedRoute,
        public sectionService: SectionService,
        private configService: ConfigService,
        private S3Service: S3Service,
        private cdr: ChangeDetectorRef  // Inject ChangeDetectorRef
    ) {
        this.sectionService.task = new Task();
        this.task = this.sectionService.task;
    }

    ngOnInit() {
        this.subscriptions.add(
            this.route.queryParams.pipe(
                debounceTime(10),
                distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
                tap(params => {
                    if ('result-summary' in params) {
                        this.currentComponent = 'result-summary';
                        this.resultUUID = params['result-summary'];
                    } else {
                        this.currentComponent = 'loader';
                        this.cdr.markForCheck();
                    }
                }),
                switchMap(() => this.fetchData()),
                catchError(error => {
                    console.error('Error downloading data:', error);
                    return of(null); // Handle error cases
                })
            ).subscribe(() => {
                this.initializationCompleted.emit(true);
                this.cdr.markForCheck(); // Ensure view is updated once everything is completed
            })
        );
    }

    private fetchData(): Promise<void> {
        const environment = this.configService.environment;
        this.task.taskName = environment.taskName;
        this.task.batchName = environment.batchName;
        return Promise.all([
            this.S3Service.downloadTaskSettings(environment),
            this.S3Service.downloadGeneralInstructions(environment),
            this.S3Service.downloadSearchEngineSettings(environment)
        ]).then(([taskSettings, generalInstructions, searchEngineSettings]) => {
            this.task.settings = new TaskSettings(taskSettings);
            this.task.initializeInstructionsGeneral(generalInstructions);
            this.task.searchEngineSettings = new SearchEngineSettings(searchEngineSettings);
        }).catch(error => {
            console.error('Error in data retrieval:', error);
            throw error;  // Rethrow the error to handle it in catchError
        });
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}
