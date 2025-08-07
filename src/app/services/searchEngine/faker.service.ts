/* Core modules */
import {Injectable} from '@angular/core';
import {from, mergeMap, Observable, toArray} from "rxjs";
/* HTTP handling modules */
import { HttpClient } from '@angular/common/http';
import {FakeSearchResponse} from "../../models/searchEngine/fakeSearchResponse";
import {BaseResponse} from "../../models/searchEngine/baseResponse";
import {concatMap, map} from "rxjs/operators";

@Injectable({
    providedIn: 'root'
})

/*
 * This class provide an implementation of a service used to perform requests to JSON Placeholder.
 * Documentation:
 * https://jsonplaceholder.typicode.com/guide/
 * The search method returns an observable of type <FakerSearchResponse>
 * You can found such interface in ../models/searchEngine/
 */
export class FakerService {

    /* JSON Placeholder resource endpoint */
    endPoint = "https://jsonplaceholder.typicode.com/posts/";

    /* HTTP client and headers */
    client: HttpClient;

    /* User search engine query */
    query: string;

    SEARCH_AMOUNT: number = 30;

    constructor(client: HttpClient) {
        this.client = client;
    }

    /*
     * This function uses the text received as a parameter to perform a request to fakeJSON
     */
    public performWebSearch(query: string): Observable<any> {
        /* The user query is saved */
        this.query = query;
        let endpointCurrent = `${this.endPoint}1`;

        return this.client.get<FakeSearchResponse>(endpointCurrent)?.pipe(
            concatMap((response: FakeSearchResponse) => {
                const firstRequestData = response; // Store the data from the first request
                return from(this.generateRandomIDs(this.SEARCH_AMOUNT))?.pipe(
                    /* Execute the HTTP requests in parallel */
                    mergeMap(id => {
                        let endpointCurrent = `${this.endPoint}${id}`;
                        return this.client?.get(endpointCurrent)?.pipe(
                            map(additionalResponse => {
                                return { id, additionalResponse };
                            })
                        );
                    }),
                    /* Collect all responses */
                    toArray(),
                    /* Combine the responses with the first request data */
                    map(additionalResponses => {
                        return {
                            firstRequestData,
                            additionalResponses,
                        };
                    })
                );
            })
        );
    }

    /*
     * This function parses the response retrieved by a request to JSON Placeholder to create a standard <BaseResponse> object to return
     */
    public decodeResponse(responses: Object[]): Array<BaseResponse> {
        let baseResponses = [];
        for (let index = 0; index < responses['additionalResponses'].length; index++) {
            let responseCurrent = responses['additionalResponses'][index]
            let data = responseCurrent['additionalResponse'] as FakeSearchResponse
            let baseResponse = new BaseResponse(
                `https://jsonplaceholder.typicode.com/posts/${data.id}`,
                data.title,
                data.body,
                false
            )
            baseResponses.push(baseResponse)
        }
        return baseResponses
    }

    public generateRandomIDs(amount): number[] {
        const numbers: number[] = [];
        while (numbers.length < amount) {
            const randomNumber = Math.floor(Math.random() * 100) + 1;
            if (!numbers.includes(randomNumber)) {
                numbers.push(randomNumber);
            }
        }
        return numbers;
    }

}
