/* Core modules */
import { Injectable } from "@angular/core";
import { from, Observable, of } from "rxjs";
import { concatMap, map, toArray } from "rxjs/operators";
/* HTTP handling modules */
import { HttpClient } from "@angular/common/http";

import {
    PubmedSearchResponse
} from "../../models/searchEngine/pubmedSearchResponse";
import {
    PubmedSummaryResponse
} from "../../models/searchEngine/pubmedSummaryResponse";
import { BaseResponse } from "../../models/searchEngine/baseResponse";

@Injectable({
    providedIn: "root"
})

/*
 * This class provides an implementation of a service used to perform requests
 * to the PubMed eUtils API.
 *
 * Documentation:
 * https://www.ncbi.nlm.nih.gov/books/NBK25500/
 *
 * The search method returns an observable whose value is an object:
 *   { firstRequestData: PubmedSearchResponse, additionalResponses: Array<{articleId, additionalResponse}> }
 * which is exactly what SearchEngineBodyComponent expects.
 */
export class PubmedService {

    apiKey: string;

    /* PubMed eUtils eSearch API endpoint */
    endPoint_eSearch = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?";
    /* PubMed eUtils eSummary API endpoint */
    endPoint_eSummary = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?";

    /* PubMed database to query */
    db: string;

    /*
     * Desired format of the retrieved response.
     * We use JSON for both eSearch and eSummary.
     */
    retmode: string;

    /* HTTP client */
    client: HttpClient;

    /* User search engine query */
    query: string;

    SEARCH_AMOUNT = 20;

    constructor(client: HttpClient) {
        /* The HTTP client is initialized */
        this.client = client;

        /* Default PubMed parameters */
        this.db = "pubmed";
        this.retmode = "json";
    }

    /*
     * This function uses the text received as a parameter to perform a request to
     * the PubMed eSearch + eSummary APIs.
     *
     * It returns an observable that emits:
     *   {
     *     firstRequestData: PubmedSearchResponse,
     *     additionalResponses: Array<{ articleId, additionalResponse }>
     *   }
     */
    public performWebSearch(
        apiKey: string,
        query: string,
        offset: number = 0,
        count: number = this.SEARCH_AMOUNT
    ): Observable<{
        firstRequestData: PubmedSearchResponse;
        additionalResponses: Array<{ articleId: string; additionalResponse: PubmedSummaryResponse }>;
    }> {
        this.apiKey = apiKey;
        /* The user query is saved */
        this.query = query;

        const effectiveCount = Math.min(count, this.SEARCH_AMOUNT);

        const endpointSearch =
            `${this.endPoint_eSearch}` +
            `db=${this.db}` +
            `&term=${this.query}` +
            `&retmode=${this.retmode}` +
            `&retmax=${effectiveCount}` +
            `&retstart=${offset}` +
            `&api_key=${this.apiKey}`;

        return this.client.get<PubmedSearchResponse>(endpointSearch).pipe(
            concatMap((response: PubmedSearchResponse) => {
                const articleIds = response.esearchresult.idlist;
                const firstRequestData = response;

                /* If there are no article IDs, immediately complete */
                if (!articleIds || articleIds.length === 0) {
                    return of({ firstRequestData, additionalResponses: [] });
                }

                /* Turn the list of article IDs into a stream of article IDs */
                return from(articleIds).pipe(
                    /*
                     * For each article ID, execute the HTTP request in sequence.
                     * This matches the original behavior; each ID is fetched individually.
                     */
                    concatMap((articleId: string) => {
                        const endpointSummary =
                            `${this.endPoint_eSummary}` +
                            `db=${this.db}` +
                            `&id=${articleId}` +
                            `&retmode=${this.retmode}` +
                            `&api_key=${this.apiKey}`;

                        return this.client
                            .get<PubmedSummaryResponse>(endpointSummary)
                            .pipe(
                                map((additionalResponse) => ({
                                    articleId,
                                    additionalResponse
                                }))
                            );
                    }),
                    /* Collect all responses */
                    toArray(),
                    /* Combine the responses with the first request data */
                    map((additionalResponses) => ({
                        firstRequestData,
                        additionalResponses
                    }))
                );
            })
        );
    }

    /*
     * This function uses the result of a request to the eSearch API
     * (which returns a list of article identifiers) to fetch the attributes
     * of a single article, if needed separately.
     */
    public retrieveArticle(id: string): Observable<PubmedSummaryResponse> {
        const apiKeyParam =
            this.apiKey && this.apiKey !== "None"
                ? `&api_key=${this.apiKey}`
                : "";

        const url =
            `${this.endPoint_eSummary}` +
            `db=${this.db}` +
            `&id=${id}` +
            `&retmode=${this.retmode}` +
            apiKeyParam;

        /* A request to PubMed eSummary API is performed and an Observable of <PubmedSummaryResponse> is returned */
        return this.client.get<PubmedSummaryResponse>(url);
    }

    /*
     * This function parses the responses retrieved by eSummary requests to
     * create a standard <BaseResponse>[] to return.
     *
     * `responses` is expected to be an array of:
     *   { articleId: string, additionalResponse: PubmedSummaryResponse }
     * as produced by performWebSearch.
     */
    public decodeResponse(responses: Array<{ articleId: string; additionalResponse: PubmedSummaryResponse }>): Array<BaseResponse> {
        const baseResponses: BaseResponse[] = [];

        for (let index = 0; index < responses.length; index++) {
            const responseCurrent = responses[index];
            const articleId = responseCurrent.articleId;
            const summaryObject = responseCurrent.additionalResponse;

            const data = summaryObject.result[articleId];

            /* Sometimes, this "data" might be undefined (e.g., no valid summary). */
            if (data) {
                const baseResponse = new BaseResponse(
                    `https://www.ncbi.nlm.nih.gov/pubmed/${articleId}`,
                    data["title"],
                    data["fulljournalname"],
                    false
                );
                baseResponse.setParameter("identifier", articleId);
                baseResponse.setParameter("sort_title", data["sorttitle"]);
                baseResponses.push(baseResponse);
            }
        }

        return baseResponses;
    }
}
