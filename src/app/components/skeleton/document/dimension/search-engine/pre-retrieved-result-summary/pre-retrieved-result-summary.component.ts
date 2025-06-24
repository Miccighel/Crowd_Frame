import {Component, OnInit, OnDestroy, Input, SimpleChanges, ViewEncapsulation} from '@angular/core';
import {Subject} from 'rxjs';

import {Title} from '@angular/platform-browser';

import {Task} from '../../../../../../models/skeleton/task';
import {PreRetrievedResult} from '../../../../../../models/searchEngine/preRetrievedResult';
import {SectionService} from '../../../../../../services/section.service';
import {NgxUiLoaderService} from "ngx-ui-loader";

@Component({
    selector: 'app-pre-retrieved-result-summary',
    templateUrl: './pre-retrieved-result-summary.component.html',
    styleUrls: ['./pre-retrieved-result-summary.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class PreRetrievedResultSummaryComponent implements OnInit, OnDestroy {

    private destroy$ = new Subject<void>();

    @Input() resultUUID: string;

    task: Task;
    preRetrievedResult: PreRetrievedResult;

    constructor(
        private titleService: Title,
        private sectionService: SectionService,
        private ngxService: NgxUiLoaderService
    ) {
        this.ngxService.startLoader('pre-retrieved-result');
        this.task = this.sectionService.task;
    }

    ngOnInit(): void {
        this.initializeResult();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['resultUUID'] && changes['resultUUID'].currentValue) {
            this.initializeResult();
        }
    }

    private initializeResult(): void {
        if (this.resultUUID) {
            this.preRetrievedResult = this.task.retrieveSearchEnginePreRetrievedResult(this.resultUUID);
            if (this.preRetrievedResult) {
                this.titleService.setTitle(this.preRetrievedResult.pageSnippet);
            } else {
                console.error('Failed to retrieve the pre-retrieved result for UUID:', this.resultUUID);
            }
        } else {
            console.error('No UUID found in route parameters.');
        }
        this.ngxService.stopLoader('pre-retrieved-result');
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    closeTab() {
        window.close()
    }
}
