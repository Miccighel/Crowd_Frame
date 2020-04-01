/* Core modules */
import { Injectable } from '@angular/core';
import {Observable} from "rxjs";

/* HTTP handling modules */
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BingWebSearchResponse } from '../models/binger/bingWebSearchResponse';
import {BaseResponse} from "../models/binger/baseResponse";

@Injectable({
  providedIn: 'root'
})

/* IMPLEMENTATION FOR MICROSOFT BING WEB SEARCH API */

export class BingService {

  /* ATTRIBUTES */

  /* Microsoft Search API key */
  apiKey = 'dd0c33c397494b6198494684a5cdad09';
  /* Microsoft Bing Web Search endpoint */
  endPoint = "https://api.cognitive.microsoft.com/bing/v7.0/search?q=";

  /* HTTP client and headers */
  client: HttpClient;
  headers : HttpHeaders;

  /* User search engine query */
  query : string;

  /* CORE FUNCTIONS */

  constructor(client: HttpClient) {

    /* The HTTP client is initialized along with its headers */
    this.client = client;
    this.headers = new HttpHeaders();
    /* The special header Ocp-Apim-Subscription-Key is required by Bing Search API and its value must be a valid apy key */
    this.headers = this.headers.set('Ocp-Apim-Subscription-Key', this.apiKey);

  }

  public performWebSearch (query: string): Observable<BingWebSearchResponse> {

    /* The user query is saved */
    this.query = query;
    /* A request to BingWebSearch API is performed and an Observable of <BingWebSearchResponse> items is returned */
    return this.client.get<BingWebSearchResponse>(`${this.endPoint}${this.query}&count=100&mkt=en-us`, {headers: this.headers})

  }

  public decodeResponse(response: BingWebSearchResponse): Array<BaseResponse> {
    let baseResponse = [];
    for (let index = 0; index < response.webPages.value.length; index++) {
      let url = response.webPages.value[index].url;
      let name = response.webPages.value[index].name;
      let snippet = response.webPages.value[index].snippet;
      baseResponse.push(new BaseResponse(url, name, snippet))
    }
    return baseResponse
  }

}
