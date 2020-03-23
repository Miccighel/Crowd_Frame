/* Core modules */
import {Injectable} from '@angular/core';
import {Observable} from "rxjs";

/* HTTP handling modules */
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {PubmedSearchResponse} from "../models/binger/pubmedSearchResponse";
import {BaseResponse} from "../models/binger/baseResponse";
import {BingWebSearchResponse} from "../models/binger/bingWebSearchResponse";
import { PubmedSummaryResponse } from '../models/binger/pubmedSummaryResponse';

@Injectable({
    providedIn: 'root'
})

/* IMPLEMENTATION FOR MICROSOFT BING WEB SEARCH API */

export class PubmedService {

    /* ATTRIBUTES */

    endPoint_eSearch = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?";
    endPoint_eSummary = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?";

    db: string;
    useHistory: boolean;
    retmode: string;

    /* HTTP client and headers */
    client: HttpClient;
    /* User search engine query */
    query: string;

    /* CORE FUNCTIONS */

    constructor(client: HttpClient) {

        /* The HTTP client is initialized along with its headers */
        this.client = client;

        /* The PubMed API parameters are set */
        this.useHistory = false;
        this.db = "pubmed";
        this.retmode = "json";

    }

    public performWebSearch(query: string): Observable<PubmedSearchResponse>{

        /* The user query is saved */
        this.query = query;
        /* A request to PubMed eSearch API is performed and an Observable of <PubmedSearchResponse> items is returned */
        return this.client.get<PubmedSearchResponse>(`${this.endPoint_eSearch}db=${this.db}&term=${this.query}&usehistory=${this.useHistory}&retmode=${this.retmode}`)

    }

    public retrieveArticle(id: string): Observable<PubmedSummaryResponse>{

        /* A request to PubMed eSummary API is performed and an Observable of <PubmedSummaryResponse> items is returned */
        return this.client.get<PubmedSummaryResponse>(`${this.endPoint_eSummary}db=${this.db}&id=${id}&retmode=${this.retmode}`)

    }

    public decodeResponse(response: PubmedSummaryResponse): BaseResponse {
        let id = response["result"]["uids"][0];
        let data = response["result"][id];
        return new BaseResponse(
            `https://www.ncbi.nlm.nih.gov/pubmed/${id}`,
            data["title"],
            data["fulljournalname"]
        );
    }

}
