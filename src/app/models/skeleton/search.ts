export class SearchSettings {

  source: string;
  domains_filter?: Array<string>;

  constructor(
    data: JSON
  ) {
    this.source = data["source"];
    if (data['domains_to_filter']) {
      this.domains_filter = new Array<string>();
      for (let domain of data["domains_to_filter"]) this.domains_filter.push(domain)
    }
  }

}
