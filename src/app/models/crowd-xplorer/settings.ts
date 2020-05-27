export class Settings {

  source: string;
  domainsToFilter: Array<string>;

  constructor(
    data: JSON
  ) {
    this.source = data['source']
    this.domainsToFilter = new Array<string>();
    for (const [_, domain] of data["domains_to_filter"].entries()) this.domainsToFilter.push(domain)
  }

}
