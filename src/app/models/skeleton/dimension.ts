/*
 * This class provides...
 */
export class Dimension {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  name: string;
  description: string;
  justification: boolean;
  url: boolean;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.name =           data["name"];
    this.description =    data["description"];
    this.justification =  data["justification"];
    this.url =            data["url"]
  }

}
