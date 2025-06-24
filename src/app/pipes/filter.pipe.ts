import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'filter',
    standalone: false
})
export class FilterPipe implements PipeTransform {

  transform(items: any[], callback: (item: any) => boolean, condTrue: boolean = true): unknown {
    if (!items || !callback) {
      return items;
    }
    return items.filter(item => condTrue ? callback(item) : !callback(item));
  }

}
