import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from "rxjs";
import {Hit} from "../models/hit";
import {AbstractControl, AsyncValidatorFn, ValidationErrors} from "@angular/forms";
import {map} from "rxjs/operators";


@Injectable({
  providedIn: 'root'
})

export class HitsService {

  client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public loadJSON(filepath: string): Observable<Array<Hit>> {
    return this.client.get<Array<Hit>>(filepath)
  }

  public validateTokenInput(filepath: string): AsyncValidatorFn {
    return (control: AbstractControl): Promise<ValidationErrors | null> | Observable<ValidationErrors | null> => {
      return this.client.get<Hit[]>(filepath).pipe(
        map(hits => {
          for(let hit of hits) {if (hit.token_input===control.value) return null}
          return {"invalid": "This token is not valid."}
        })
      )
    }
  }

}


