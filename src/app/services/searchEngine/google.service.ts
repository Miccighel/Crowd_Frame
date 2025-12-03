// src/app/services/searchEngine/google.service.ts

import {Injectable} from "@angular/core";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Observable} from "rxjs";

import {
    GoogleWebSearchResponse,
    GoogleSearchItem
} from "../../models/searchEngine/googleWebSearchResponse";
import {BaseResponse} from "../../models/searchEngine/baseResponse";

@Injectable({
    providedIn: "root"
})
export class GoogleService {

    /* Google Custom Search JSON API key */
    apiKey: string;

    /* Programmable Search Engine ID (cx) */
    cx: string;

    /*
     * Google Custom Search endpoint slug.
     * In dev, proxy.conf.json should map "/google" → https://www.googleapis.com/customsearch/v1
     * In prod, SearchEngineBodyComponent will overwrite this with the API Gateway route.
     */
    endPoint = "google";

    client: HttpClient;
    headers: HttpHeaders;

    /* Stored query */
    query: string;

    /*
     * Google allows num up to 10 results per request for Custom Search JSON.
     * See docs: num ≤ 10.
     */
    SEARCH_AMOUNT = 10;

    constructor(client: HttpClient) {
        this.client = client;
    }

    /**
     * Perform a web search using Google Custom Search JSON API.
     *
     * @param apiKey Google API key
     * @param cx Programmable Search Engine ID
     * @param query already URL-encoded query string (we do *not* encode again)
     * @param resultsToSkip how many results we have already loaded (Crowd_Frame semantics)
     * @param count desired page size (capped at Google's max)
     */
    public performWebSearch(
        apiKey: string,
        cx: string,
        query: string,
        resultsToSkip: number = 0,
        count: number = this.SEARCH_AMOUNT
    ): Observable<GoogleWebSearchResponse> {
        this.apiKey = apiKey;
        this.cx = cx;
        this.query = query;

        const effectiveCount = Math.min(count, this.SEARCH_AMOUNT);

        /*
         * Google uses 1-based index for `start`.
         * Crowd_Frame passes "resultsToSkip" as number of already loaded items.
         * So startIndex = resultsToSkip + 1, but also respect Google's max (start <= 91 for num=10).
         */
        const maxStart = 91; // to stay within 100 results limit for num=10
        const startIndex = Math.min(resultsToSkip + 1, maxStart);

        const headers = new HttpHeaders({
            Accept: "application/json"
        });

        this.headers = headers;

        const endpointWithParameters =
            `${this.endPoint}?key=${encodeURIComponent(this.apiKey)}` +
            `&cx=${encodeURIComponent(this.cx)}` +
            `&q=${this.query}` +
            `&num=${effectiveCount}` +
            `&start=${startIndex}`;

        return this.client.get<GoogleWebSearchResponse>(endpointWithParameters, {
            headers: this.headers
        });
    }

    /**
     * Filter out results from unwanted domains (same semantics as BingService.filterResponse)
     */
    public filterResponse(
        response: GoogleWebSearchResponse,
        domains: string[]
    ): GoogleWebSearchResponse {
        if (!response.items || !Array.isArray(response.items)) {
            return response;
        }

        for (const domain of domains) {
            for (let i = 0; i < response.items.length; i++) {
                const r = response.items[i];
                const url = r.link ?? "";
                const snippet = r.snippet ?? "";
                if (url.indexOf(domain) > -1 || snippet.indexOf(domain) > -1) {
                    response.items.splice(i--, 1);
                }
            }
        }
        return response;
    }

    /**
     * Decode Google results into Crowd_Frame's BaseResponse[]
     * while mimicking Bing’s/Brave’s parameter names:
     * identifier, display_url, page_language, is_family_friendly, is_navigational, date_last_crawled.
     */
    public decodeResponse(response: GoogleWebSearchResponse): BaseResponse[] {
        const baseResponses: BaseResponse[] = [];

        if (!response.items || !Array.isArray(response.items)) {
            return baseResponses;
        }

        // Google does not explicitly flag navigational / family friendly in this API.
        const isNavigational = false;
        const isFamilyFriendly = true;

        for (const item of response.items as GoogleSearchItem[]) {
            const url = item.link ?? "";
            const title = item.title ?? url;
            const snippet = item.snippet ?? "";

            const baseResponse = new BaseResponse(url, title, snippet, false);

            baseResponse.setParameter("identifier", url);
            baseResponse.setParameter("date_last_crawled", "");
            baseResponse.setParameter(
                "display_url",
                item.displayLink || item.formattedUrl || url
            );
            baseResponse.setParameter("page_language", "");
            baseResponse.setParameter("is_navigational", isNavigational);
            baseResponse.setParameter("is_family_friendly", isFamilyFriendly);

            baseResponses.push(baseResponse);
        }

        return baseResponses;
    }
}
