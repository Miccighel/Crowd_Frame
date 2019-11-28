import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {Observable} from "rxjs";
import {Document} from "./interfaces/document";

@Injectable({
  providedIn: 'root'
})

export class S3Service {

  endPoint = "https://kevinr.s3.us-east-2.amazonaws.com/angular/";

  client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public retrieveDocument (filename: string): Observable<Document> {
    return this.client.get<Document>(`${this.endPoint}${filename}`)
  }

}
