/* Core modules */
import {environment} from '../../environments/environment';
import {Injectable} from "@angular/core";

@Injectable({
  providedIn: 'root'
})

/*
 * This class provide an implementation of a service used to provide environment variables
 */
export class ConfigService {
  environment = environment
}
