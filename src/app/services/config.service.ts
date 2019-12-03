import {environment} from '../../environments/environment';
import {Injectable} from "@angular/core";

@Injectable({
  providedIn: 'root'
})

export class ConfigService {
  environment = environment
}
