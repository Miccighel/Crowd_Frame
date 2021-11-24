/* Core modules */
import {Injectable} from '@angular/core';
import {Observable} from "rxjs";
/* HTTP handling modules */
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {PubmedSearchResponse} from "../models/crowd-xplorer/pubmedSearchResponse";
import {BaseResponse} from "../models/crowd-xplorer/baseResponse";
import {PubmedSummaryResponse} from '../models/crowd-xplorer/pubmedSummaryResponse';

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
  public performWebSearch(query: string): Observable<PubmedSearchResponse> {
    /* The user query is saved */
    this.query = query;
    /* A request to PubMed eSearch API is performed and an Observable of <PubmedSearchResponse> items is returned */
    return this.client.get<PubmedSearchResponse>(`${this.endPoint_eSearch}db=${this.db}&term=${this.query}&usehistory=${this.useHistory}&retmode=${this.retmode}`)
  }

  /*
   * This function uses the result of a request to the eSearch API (which returns a list of article identifiers) to fetch the attributes of each article
   */
  public retrieveArticle(id: string): Observable<PubmedSummaryResponse> {
    /* A request to PubMed eSummary API is performed and an Observable of <PubmedSummaryResponse> items is returned */
    return this.client.get<PubmedSummaryResponse>(`${this.endPoint_eSummary}db=${this.db}&id=${id}&retmode=${this.retmode}`)
  }

  /*
   * This function parses the response retrieved by a eSummary request to Pubmed eUtilities to create a standard <BaseResponse> object to return
   */
  public decodeResponse(response: PubmedSummaryResponse): BaseResponse {
    let id = response["result"]["uids"][0];
    let data = response["result"][id];
    return new BaseResponse(
      `https://www.ncbi.nlm.nih.gov/pubmed/${id}`,
      data["title"],
      data["fulljournalname"]
    );
  }

}
