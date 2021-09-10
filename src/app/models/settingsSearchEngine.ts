export class SettingsSearchEngine {

  source: string;
  domains_filter?: Array<string>;

  constructor(
    data = null as JSON
  ) {
    this.source = data ? data["source"] : null;
    this.domains_filter = new Array<string>();
    if(data) if("domains_filter" in data)  for (let domain of data["domains_filter"] as Array<string>) this.domains_filter.push(domain)
    if(data) {
      if (data['domains_to_filter']) {
        for (let domain of data["domains_to_filter"]) this.domains_filter.push(domain)
      }
    } else {
      this.domains_filter = new Array<string>();
    }
  }

}
