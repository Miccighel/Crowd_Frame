/* Core modules */
import {Injectable} from '@angular/core';
import {Observable} from "rxjs";
/* HTTP handling modules */
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {BingWebSearchResponse} from '../models/bingWebSearchResponse';
import {BaseResponse} from "../models/baseResponse";

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
  endPoint = "https://api.bing.microsoft.com/v7.0/search?q=";

  /* HTTP client and headers */
  client: HttpClient;
  headers: HttpHeaders;

  /* User search engine query */
  query: string;

  constructor(client: HttpClient) {
    /* The HTTP client is initialized along with its headers */
    this.client = client;
  }

  /*
   * This function uses the text received as a parameter to perform a request to Bing Web Search
   */
  public performWebSearch(apiKey:string, query: string): Observable<BingWebSearchResponse> {
    this.apiKey = apiKey
    /* The user query is saved */
    this.query = query;
    this.headers = new HttpHeaders();
    /* The special header Ocp-Apim-Subscription-Key is required by Bing Search API and its value must be a valid apy key */
    this.headers = this.headers.set('Ocp-Apim-Subscription-Key', this.apiKey);
    /* A request to BingWebSearch API is performed and an Observable of <BingWebSearchResponse> items is returned */
    return this.client.get<BingWebSearchResponse>(`${this.endPoint}${this.query}&count=100&mkt=en-us`, {headers: this.headers})
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
    let baseResponse = [];
    /* The JSON array of retrieved web pages is parsed to find for each result: */
    for (let index = 0; index < response.webPages.value.length; index++) {
      /* The web page url */
      let url = response.webPages.value[index].url;
      /* The web page name */
      let name = response.webPages.value[index].name;
      /* The web page snippet */
      let snippet = response.webPages.value[index].snippet;
      /* These three elements are used to init a standard base response */
      baseResponse.push(new BaseResponse(url, name, snippet))
    }
    return baseResponse
  }

}
