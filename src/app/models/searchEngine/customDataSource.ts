import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import {BaseResponse} from "./baseResponse";

// Assume that your custom data source interacts with an API to fetch data.
// Modify the fetchData method according to your API structure.

export class CustomDataSource implements DataSource<BaseResponse> {

    private dataSubject = new BehaviorSubject<BaseResponse[]>([]);
    private loadingSubject = new BehaviorSubject<boolean>(false);

    public loading$ = this.loadingSubject.asObservable();

    constructor(
        private fetchData: (queryValue : string, resultsToSkip: number, querySentByUser: boolean) => Observable<BaseResponse[]>
    ) {}

    connect(collectionViewer: CollectionViewer): Observable<BaseResponse[]> {
        return this.dataSubject.asObservable();
    }

    disconnect(collectionViewer: CollectionViewer): void {
        this.dataSubject.complete();
        this.loadingSubject.complete();
    }

    loadData(queryValue : string, resultsToSkip: number, querySentByUser: boolean): void {
        this.loadingSubject.next(true);
        this.fetchData(queryValue, resultsToSkip, querySentByUser)
            .pipe(
                catchError(() => of([])), /* Return empty array on error */
                finalize(() => this.loadingSubject.next(false))
            )
            .subscribe((data) => this.dataSubject.next(data));
    }
}
