/* Core modules */
import {Injectable} from '@angular/core';
import {Observable} from "rxjs";
/* HTTP handling modules */
import {HttpClient} from '@angular/common/http';
import {FakerSearchResponse} from "../models/fakerSearchResponse";
import {BaseResponse} from "../models/baseResponse";

@Injectable({
  providedIn: 'root'
})

/*
 * This class provide an implementation of a service used to perform requests to the fakeJSON API.
 * Documentation:
 * https://fakejson.com/documentation#introduction
 * The search method returns an observable of type <FakerSearchResponse>
 * You can found such interface in ../models/
 */
export class FakerService {

  // |--------- ELEMENTS - DECLARATION ---------|

  /* FakeJSON Search API key */
  token = 'sPblHj23AzPvKp84rdr0ng';
  /* Fake JSON Search endpoint */
  endPoint = "https://app.fakejson.com/q";

  /* HTTP client and headers */
  client: HttpClient;

  /* User search engine query */
  query: string;

  // |--------- CONSTRUCTOR ---------|

  constructor(client: HttpClient) {
    /* The HTTP client is initialized */
    this.client = client;
  }

  // |--------- ELEMENTS - FUNCTIONS ---------|

  /*
   * This function uses the text received as a parameter to perform a request to fakeJSON
   */
  public performWebSearch(query: string): Observable<Array<FakerSearchResponse>> {
    /* The user query is saved */
    this.query = query;
    /* A request to FakeJSON API is performed and an Observable an array of <FakerSearchResponse> items is returned */
    return this.client.post<Array<FakerSearchResponse>>(this.endPoint,
      {
        "token": "rHbvIkFUIUi-0lEcy8eJJQ",
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

  /*
   * This function parses the response retrieved by a request to fakeJSON to create a standard <BaseResponse> object to return
   */
  public decodeResponse(response: Array<FakerSearchResponse>): Array<BaseResponse> {
    let baseResponse = [];
    /* The JSON array of retrieved web pages is parsed to find for each result: */
    for (let index = 0; index < response.length; index++) {
      /* The web page url */
      let url = response[index].url;
      /* The web page name */
      let name = response[index].name;
      /* The web page snippet */
      let snippet = response[index].text;
      /* These three elements are used to init a standard base response */
      baseResponse.push(new BaseResponse(url, name, snippet))
    }
    return baseResponse
  }

}
