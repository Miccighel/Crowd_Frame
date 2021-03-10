export class Settings {

  task_name: string;
  batch_name: string;
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

    this.task_name =            data["task_name"];
    this.batch_name =           data["batch_name"];
    this.allowedTries =         parseInt((data["allowed_tries"]));
    this.timeCheckAmount =      parseInt((data["time_check_amount"]));
    this.annotator =            data["annotator"] ? new Annotator(data["annotator"]) : null;
    this.countdownTime =        data["countdown_time"] ? parseInt((data["countdown_time"])): null;
    this.blacklistBatches = new Array<string>();
    for (const [_, otherBatch]  of data["blacklist_batches"].entries()) this.blacklistBatches.push(otherBatch)
    this.whitelistBatches = new Array<string>();
    for (const [_, otherBatch]  of data["whitelist_batches"].entries()) this.whitelistBatches.push(otherBatch)
    if (data['messages']) {
      this.messages = new Array<string>();
      for (const [_, message] of data["messages"].entries()) this.messages.push(message)
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
