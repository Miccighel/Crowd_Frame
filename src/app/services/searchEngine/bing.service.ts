/* Core modules */
import {Injectable} from '@angular/core';
import {Observable, map} from "rxjs";
/* HTTP handling modules */
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {BingWebSearchResponse} from '../../models/searchEngine/bingWebSearchResponse';
import {BaseResponse} from "../../models/searchEngine/baseResponse";
import {tap} from "rxjs/operators";

@Injectable({
    providedIn: 'root'
})

/*
 * This class provide an implementation of a service used to perform requests to the Bing Web Search API.
 * Documentation:
 * https://azure.microsoft.com/it-it/services/cognitive-services/bing-web-search-api/
 * The search method returns an observable of type <BingWebSearchResponse>
 * You can found such interface in ../models/
 */
export class BingService {

    /* Microsoft Search API key */
    apiKey: string
    /* Microsoft Bing Web Search endpoint */
    /* NOTE: In a development environment, the reverse proxy (see proxy.conf.json) in the app's root rewrites the slug to point directly to Bing's endpoint.
     * In a production environment, on the other hand, the endpoint must be extracted from the environment itself, since the request has to be sent to the API Gateway route,
     * which then proxies the request to Bing's API.
     */
    endPoint = "bing/";

    /* HTTP client and headers */
    client: HttpClient;
    headers: HttpHeaders;

    msEdgeClientID: string
    bingAPIMarket: string
    bingAPITraceId: string

    ipAddress: string
    latitude: number
    longitude: number
    accuracy: number
    altitude: number
    altitudeAccuracy: number

    /* User search engine query */
    query: string;

    SEARCH_AMOUNT: number = 50;
    constructor(client: HttpClient) {
        /* The HTTP client is initialized along with its headers */
        this.client = client;
    }

    /*
     * This function uses the text received as a parameter to perform a request to Bing Web Search
     */
    public performWebSearch(apiKey: string, query: string, offset: number = 0, count: number = this.SEARCH_AMOUNT): Observable<BingWebSearchResponse> {
        this.apiKey = apiKey;
        /* The user query is saved */
        this.query = query;
        /* The special header Ocp-Apim-Subscription-Key is required by Bing Search API and its value must be a valid API key */
        this.headers = new HttpHeaders({
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'Content-Type': 'application/json'
        });
        if (this.msEdgeClientID)
            this.headers = this.headers.set('X-MSEdge-ClientID', this.msEdgeClientID)
        if (this.ipAddress)
            this.headers = this.headers.set('X-MSEdge-ClientIP', this.ipAddress)
        if (this.longitude && this.latitude && this.accuracy) {
            let xSearchLocation = `lat:${this.latitude},long:${this.longitude},re:${this.accuracy}`
            if (this.altitude)
                xSearchLocation = `${xSearchLocation},alt:${this.altitude},are:${this.altitudeAccuracy}`
            this.headers = this.headers.set('X-Search-Location', xSearchLocation)
        }

        let endpointWithParameters = `${this.endPoint}?q=${this.query}&count=${count}&offset=${offset}&mkt=en-us`
        return this.client.get<BingWebSearchResponse>(endpointWithParameters, {headers: this.headers, observe: 'response'}).pipe(
            tap(response => {
                let currentClientId = response.headers.get('X-MSEdge-ClientID')
                if (currentClientId)
                    this.msEdgeClientID = response.headers.get('X-MSEdge-ClientID')
                this.bingAPIMarket = response.headers.get('BingAPIs-Market')
                this.bingAPITraceId = response.headers.get('BingAPIs-TraceId')
            }),
            map(response => {
                response.body.clientId = this.msEdgeClientID
                response.body.apiMarket = this.bingAPIMarket
                response.body.traceId = this.bingAPITraceId
                return response.body
            }) /* Extract the body from the response */
        );
    }


    /*
     * This function parses the response retrieved by a request to Bing Web Search to filter out those that are retrieved from unwanted domains
     */
    public filterResponse(response: BingWebSearchResponse, domains: Array<string>) {
        for (let domain of domains) {
            for (let i = 0; i < response.webPages.value.length; i++) {
                if (response.webPages.value[i]['url'].indexOf(domain) > -1) response.webPages.value.splice(i--, 1);
            }
        }
        return response
    }

    /*
     * This function parses the response retrieved by a request to Bing Web Search to create a standard <BaseResponse> object to return
     */
    public decodeResponse(response: BingWebSearchResponse): Array<BaseResponse> {
        let baseResponses = [];
        for (let index = 0; index < response.rankingResponse.mainline.items.length; index++) {
            let rankData = response.rankingResponse.mainline.items[index]
            let responseId = rankData.value['id']
            for (let index = 0; index < response.webPages.value.length; index++) {
                let responseCurrent = response.webPages.value[index]
                if (responseCurrent.id == responseId) {
                    let baseResponse = new BaseResponse(
                        responseCurrent.url,
                        responseCurrent.name,
                        responseCurrent.snippet
                    )
                    baseResponse.setParameter('identifier', responseId)
                    baseResponse.setParameter('date_last_crawled', responseCurrent.dateLastCrawled)
                    baseResponse.setParameter('display_url', responseCurrent.displayUrl)
                    baseResponse.setParameter('page_language', responseCurrent.language)
                    baseResponse.setParameter('is_navigational', responseCurrent.isNavigational)
                    baseResponse.setParameter('is_family_friendly', responseCurrent.isFamilyFriendly)
                    baseResponses.push(baseResponse)
                }
            }
        }
        return baseResponses
    }

}
