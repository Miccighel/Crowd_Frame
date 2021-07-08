export class SettingsTask {

  allowed_tries: number;
  time_check_amount: number;
  attributes: Array<Attribute>
  annotator?: Annotator;
  countdown_time?: number;
  blacklistBatches: Array<string>;
  whitelistBatches: Array<string>;
  messages?: Array<string>;

  constructor(
    data = null as JSON
  ) {

    if(data) {
      if ('domains_to_filter' in data) {
        data['domains_filter'] = data['domains_to_filter']
        delete data['domains_to_filter']
      }
    }
    this.allowed_tries =  data ? parseInt((data["allowed_tries"])) : 0;
    this.time_check_amount = data? parseInt((data["time_check_amount"])): 0;
    this.attributes = new Array<Attribute>()
    if (data) {
      if ('attributes' in data) {
        let attributes = data["attributes"] as Array<JSON>
        for (let attribute of attributes) this.attributes.push(new Attribute(attribute))
      }
    }
    this.annotator =          data ?  data["annotator"] ? new Annotator(data["annotator"]) : null : null;
    this.countdown_time =     data ?   data["countdown_time"] ? parseInt((data["countdown_time"])): null : null;
    this.blacklistBatches = new Array<string>();
    if(data) for (let batch of data["blacklist_batches"]) this.blacklistBatches.push(batch)
    this.whitelistBatches = new Array<string>();
    if(data) for (let batch of data["whitelist_batches"]) this.whitelistBatches.push(batch)
    this.messages = new Array<string>();
    if(data) {
      if (data['messages']) {
        for (let message of data["messages"]) this.messages.push(message)
      }
    }
  }

}

export class Attribute {

  show: boolean;
  annotate: boolean;

  constructor(
    data: JSON
  ) {
    this.show = data["show"];
    this.annotate = data["annotate"];
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
