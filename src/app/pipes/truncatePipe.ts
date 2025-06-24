/* Core */
import {Pipe, PipeTransform} from "@angular/core";
/* Pipes */
@Pipe({
    name: 'truncate',
    standalone: false
})

/*
 * This class provides an implementation for a Pipe which can be used to truncate texts
 * Documentation:
 * https://angular.io/guide/pipes
 */
export class TruncatePipe implements PipeTransform {

    /* This function takes a string in input and cuts it up to the limit, adding an optional trailing text at the end */
    transform(value: string, limit: number, trail: String = '…'): string {
        let result = value || '';
        if (value) {
            const words = value.split(/\s+/);
            if (words.length > Math.abs(limit)) {
                if (limit < 0) {
                    limit *= -1;
                    result = trail + words.slice(words.length - limit, words.length).join(' ');
                } else {
                    result = words.slice(0, limit).join(' ') + trail;
                }
            }
        }
        return result;
    }

}
