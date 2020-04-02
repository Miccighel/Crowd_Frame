/* Core modules */
import {Injectable} from '@angular/core';
import {Observable} from "rxjs";

/* HTTP handling modules */
import {HttpClient} from '@angular/common/http';
import {FakerSearchResponse} from "../models/binger/fakerSearchResponse";
import {BaseResponse} from "../models/binger/baseResponse";

@Injectable({
    providedIn: 'root'
})

/* IMPLEMENTATION FOR MICROSOFT BING WEB SEARCH API */

export class FakerService {

    /* ATTRIBUTES */

    /* FakeJSON Search API key */
    token = 'sPblHj23AzPvKp84rdr0ng';
    /* Fake JSON Search endpoint */
    endPoint = "https://app.fakejson.com/q";

    /* HTTP client and headers */
    client: HttpClient;
    /* User search engine query */
    query: string;

    /* CORE FUNCTIONS */

    constructor(client: HttpClient) {

        /* The HTTP client is initialized along with its headers */
        this.client = client;

    }

    public performWebSearch(query: string): Observable<Array<FakerSearchResponse>> {

        /* The user query is saved */
        this.query = query;
        /* A request to FakeJSON API is performed and an Observable of <BingWebSearchResponse> items is returned */
        return this.client.post<Array<FakerSearchResponse>>(this.endPoint,
            {
                "token": "sPblHj23AzPvKp84rdr0ng",
                "parameters": {
                    "code": 200
                },
                "data": {
                    "url": "internetUrl",
                    "name": "stringShort",
                    "text": "stringLong",
                    "_repeat": 8
                }
            }
        )
    }

    public decodeResponse(response: Array<FakerSearchResponse>): Array<BaseResponse> {
        let baseResponse = [];
        for (let index = 0; index < response.length; index++) {
            let url = response[index].url;
            let name = response[index].name;
            let snippet = response[index].text;
            baseResponse.push(new BaseResponse(url, name, snippet))
        }
        return baseResponse
    }

}
