import {Injectable} from "@angular/core";

@Injectable({
  providedIn: 'root'
})


export class DebugService {

    constructor() {}

    public selectRandomToken(hits) {
        let hitChosen = hits[Math.floor(Math.random() * hits.length)]
        return hitChosen['token_input']
    }

}