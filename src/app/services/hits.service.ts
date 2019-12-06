import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})

export class HitsService {

  client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public loadJSON(filepath: string): Observable<JSON> {
    return this.client.get<JSON>(filepath)
  }

}
