export class SettingsSearchEngine {

  source: string;
  domains_filter?: Array<string>;

  constructor(
    data = null as JSON
  ) {
    this.source = data ? data["source"] : null;
    if(data) {
      if (data['domains_to_filter']) {
        this.domains_filter = new Array<string>();
        for (let domain of data["domains_to_filter"]) this.domains_filter.push(domain)
      }
    } else {
      this.domains_filter = new Array<string>();
    }
  }

}
