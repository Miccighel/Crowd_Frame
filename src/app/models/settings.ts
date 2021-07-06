export class Settings {

  allowedTries: number;
  timeCheckAmount: number;
  annotator?: Annotator;
  countdownTime?: number;
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
    this.allowedTries =         parseInt((data["allowed_tries"]));
    this.timeCheckAmount =      parseInt((data["time_check_amount"]));
    this.annotator =            data["annotator"] ? new Annotator(data["annotator"]) : null;
    this.countdownTime =        data["countdown_time"] ? parseInt((data["countdown_time"])): null;
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
