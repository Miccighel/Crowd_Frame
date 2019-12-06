import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {Observable} from "rxjs";
import {Document} from "../models/document";

@Injectable({
  providedIn: 'root'
})

export class S3Service {

  client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public retrieveDocument (url: string): Observable<Document> {
    return this.client.get<Document>(url)
  }

}
