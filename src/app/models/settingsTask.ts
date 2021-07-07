export class SettingsTask {

  allowed_tries: number;
  time_check_amount: number;
  annotator?: Annotator;
  countdown_time?: number;
  blacklistBatches: Array<string>;
  whitelistBatches: Array<string>;
  messages?: Array<string>;

  constructor(
    data: JSON
  ) {

    if('domains_to_filter' in data) {
      data['domains_filter'] = data['domains_to_filter']
      delete data['domains_to_filter']
    }
    this.allowed_tries =         parseInt((data["allowed_tries"]));
    this.time_check_amount =      parseInt((data["time_check_amount"]));
    this.annotator =            data["annotator"] ? new Annotator(data["annotator"]) : null;
    this.countdown_time =        data["countdown_time"] ? parseInt((data["countdown_time"])): null;
    this.blacklistBatches = new Array<string>();
    for (let batch of data["blacklist_batches"]) this.blacklistBatches.push(batch)
    this.whitelistBatches = new Array<string>();
    for (let batch of data["whitelist_batches"]) this.whitelistBatches.push(batch)
    if (data['messages']) {
      this.messages = new Array<string>();
      for (let message of data["messages"]) this.messages.push(message)
    }
  }

}

export class Annotator {

  type: string;
  values?: Array<Object>

  constructor(
    data: JSON
  ) {
    this.type =     data["type"];
    this.values =     data["values"] ? data["values"]  : null;
  }

}
