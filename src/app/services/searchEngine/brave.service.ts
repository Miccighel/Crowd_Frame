import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";

import {
    BraveWebSearchResponse,
    BraveSearchResult
} from "../../models/searchEngine/braveWebSearchResponse";
import { BaseResponse } from "../../models/searchEngine/baseResponse";

@Injectable({
    providedIn: "root"
})
export class BraveService {
    /* Brave Search API key */
    apiKey: string;

    /*
     * Brave Web Search endpoint slug.
     * In dev, proxy.conf.json should map "/brave" → https://api.search.brave.com/res/v1/web/search
     * In prod, SearchEngineBodyComponent will overwrite this with the API Gateway route.
     */
    endPoint = "brave";

    client: HttpClient;
    headers: HttpHeaders;

    /* Optional geo/location hints (mapped to X-Loc-* headers) */
    ipAddress: string | undefined;
    latitude: number | undefined;
    longitude: number | undefined;

    /* Stored query */
    query: string;

    /*
     * Brave only allows count <= 20 for web results.
     * Use 20 here and page internally.
     */
    SEARCH_AMOUNT = 20;

    constructor(client: HttpClient) {
        this.client = client;
    }

    public performWebSearch(
        apiKey: string,
        query: string,
        resultsToSkip: number = 0,
        count: number = this.SEARCH_AMOUNT
    ): Observable<BraveWebSearchResponse> {
        this.apiKey = apiKey;
        this.query = query;

        const effectiveCount = Math.min(count, this.SEARCH_AMOUNT);

        const pageOffset = Math.min(
            Math.floor(resultsToSkip / effectiveCount),
            9 /* Brave's max offset */
        );

        /* Required + recommended headers (NO Accept-Encoding) */
        let headers = new HttpHeaders({
            "X-Subscription-Token": this.apiKey,
            Accept: "application/json",
            "Api-Version": "2023-10-11"
        });

        /* Optional geo hints */
        if (this.latitude != null) {
            headers = headers.set("X-Loc-Lat", String(this.latitude));
        }
        if (this.longitude != null) {
            headers = headers.set("X-Loc-Long", String(this.longitude));
        }

        this.headers = headers;

        const endpointWithParameters =
            `${this.endPoint}?q=${this.query}` +
            `&count=${effectiveCount}` +
            `&offset=${pageOffset}` +
            `&search_lang=en` +
            `&ui_lang=en-US` +
            `&safesearch=moderate`;

        return this.client.get<BraveWebSearchResponse>(endpointWithParameters, {
            headers: this.headers
        });
    }

    public filterResponse(
        response: BraveWebSearchResponse,
        domains: string[]
    ): BraveWebSearchResponse {
        if (!response.web || !response.web.results) return response;

        for (const domain of domains) {
            for (let i = 0; i < response.web.results.length; i++) {
                const result = response.web.results[i];
                const url = result.url ?? "";
                const snippet = result.description ?? "";
                if (url.indexOf(domain) > -1 || snippet.indexOf(domain) > -1) {
                    response.web.results.splice(i--, 1);
                }
            }
        }
        return response;
    }

    public decodeResponse(response: BraveWebSearchResponse): BaseResponse[] {
        const baseResponses: BaseResponse[] = [];

        if (!response.web || !Array.isArray(response.web.results)) {
            return baseResponses;
        }

        const isNavigational = response.query?.is_navigational ?? false;

        for (const result of response.web.results as BraveSearchResult[]) {
            const title = result.title || result.url;
            const snippet = result.description || "";
            const baseResponse = new BaseResponse(result.url, title, snippet, false);

            baseResponse.setParameter("identifier", result.url);
            baseResponse.setParameter(
                "date_last_crawled",
                result.page_fetched || result.page_age || ""
            );
            baseResponse.setParameter(
                "display_url",
                result.meta_url?.path || result.url
            );
            baseResponse.setParameter("page_language", result.language || "");
            baseResponse.setParameter("is_navigational", isNavigational);
            baseResponse.setParameter(
                "is_family_friendly",
                result.family_friendly
            );

            if (Array.isArray(result.extra_snippets)) {
                baseResponse.setParameter("extra_snippets", result.extra_snippets);
            }

            baseResponses.push(baseResponse);
        }

        return baseResponses;
    }
}
