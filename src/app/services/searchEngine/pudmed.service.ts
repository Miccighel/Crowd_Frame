/* Core modules */
import {Injectable} from '@angular/core';
import {from, Observable, of, toArray} from "rxjs";
import {concatMap, map} from "rxjs/operators";
/* HTTP handling modules */
import {HttpClient} from '@angular/common/http';
import {PubmedSearchResponse} from "../../models/searchEngine/pubmedSearchResponse";
import {BaseResponse} from "../../models/searchEngine/baseResponse";
import {PubmedSummaryResponse} from '../../models/searchEngine/pubmedSummaryResponse';

@Injectable({
    providedIn: 'root'
})

/*
 * This class provide an implementation of a service used to perform requests to the Pubmed eUtils API.
 * Documentation:
 * https://www.ncbi.nlm.nih.gov/books/NBK25500/
 * The search method returns an observable of type <PubmedSearchResponse>
 * You can found such interface in ../models/
 */
export class PubmedService {

    apiKey: string

    /* Pubmed eUtils eSearch API Endpoint */
    endPoint_eSearch = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?";
    /* Pubmed eUtils eSummary API Endpoint */
    endPoint_eSummary = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?";

    /* Pubmed database to quer */
    db: string;
    /* When usehistory is set to 'y', ESearch will post the UIDs resulting from the search operation onto the History server so that they can be used directly in a subsequent E-utility cal */
    useHistory: boolean;
    /* Desired format of the retrieved response */
    retmode: string;

    /* HTTP client and headers */
    client: HttpClient;

    /* User search engine query */
    query: string;


    constructor(client: HttpClient) {
        /* The HTTP client is initialized along with its headers */
        this.client = client;
        /* The PubMed API parameters are set */
        /* There is no need to use the history parameter*/
        this.useHistory = false;
        /* The default pubmed datased would suffice */
        this.db = "pubmed";
        /* JSON Responses are needed */
        this.retmode = "json";
    }

    /*
     * This function uses the text received as a parameter to perform a request to Pubmed eUtilities API
     */
    public performWebSearch(apiKey: string, query: string, count: number = 100, offset: number = 0): Observable<any> {
        this.apiKey = apiKey
        /* The user query is saved */
        this.query = query;
        let apiKeyCurrent= this.apiKey=="None" ? ""  : `&api_key=${this.apiKey}`
        let endpointSearch = `${this.endPoint_eSearch}db=${this.db}&term=${this.query}&usehistory=${this.useHistory}&retmode=${this.retmode}&retmax=${count}&retstart=${offset}${apiKeyCurrent}`
        return this.client.get<PubmedSearchResponse>(endpointSearch).pipe(
            concatMap((response: PubmedSearchResponse) => {
                const articleIds = response.esearchresult.idlist;
                const firstRequestData = response; // Store the data from the first request
                /* If there are no article IDs, immediately complete */
                if (articleIds.length === 0) {
                    return of({firstRequestData, additionalResponses: []});
                }
                /* Turn the list of article IDs into a stream of article IDs */
                return from(articleIds).pipe(
                    /* For each article ID, execute the HTTP request in sequence */
                    concatMap(articleId => {
                            let endpointSummary = `${this.endPoint_eSummary}db=${this.db}&id=${articleId}&retmode=${this.retmode}${apiKeyCurrent}`
                            return this.client.get(endpointSummary).pipe(
                                map(additionalResponse => {
                                    return ({articleId, additionalResponse});
                                })
                            );
                        }
                    ),
                    /* Collect all responses */
                    toArray(),
                    /* Combine the responses with the first request data */
                    map(additionalResponses => {
                        return ({
                            firstRequestData,
                            additionalResponses
                        });
                    })
                );
            })
        );
    }

    /*
     * This function uses the result of a request to the eSearch API (which returns a list of article identifiers) to fetch the attributes of each article
     */
    public retrieveArticle(id: string): Observable<PubmedSummaryResponse> {
        let api_key = this.apiKey == "None" ? `&api_key=${this.apiKey}` : ""
        /* A request to PubMed eSummary API is performed and an Observable of <PubmedSummaryResponse> items is returned */
        return this.client.get<PubmedSummaryResponse>(`${this.endPoint_eSummary}db=${this.db}&id=${id}&retmode=${this.retmode}${api_key}`)
    }

    /*
     * This function parses the response retrieved by a eSummary request to Pubmed eUtilities to create a standard <BaseResponse> object to return
     */
    public decodeResponse(responses: Object[]): Array<BaseResponse> {
        let baseResponses = [];
        for (let index = 0; index < responses.length; index++) {
            let responseCurrent = responses[index]
            let articleId = responseCurrent['articleId']
            let summaryObject = responseCurrent["additionalResponse"] as PubmedSummaryResponse;
            let data = summaryObject.result[articleId]
            /* Sometimes, this "data" might be undefined. */
            if (data) {
                let baseResponse = new BaseResponse(
                    `https://www.ncbi.nlm.nih.gov/pubmed/${articleId}`,
                    data["title"],
                    data["fulljournalname"]
                )
                baseResponse.setParameter('identifier', articleId)
                baseResponse.setParameter('sort_title', data['sorttitle'])
                baseResponses.push(baseResponse)
            }

        }
        return baseResponses
    }

}
