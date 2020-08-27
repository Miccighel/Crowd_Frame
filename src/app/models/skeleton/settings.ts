export class Settings {

  allowedTries: number;
  timeCheckAmount: number;
  blacklistBatches: Array<string>;
  whitelistBatches: Array<string>;
  messages?: Array<string>;

  constructor(
    data: JSON
  ) {
    this.allowedTries =         parseInt((data["allowed_tries"]));
    this.timeCheckAmount =      parseInt((data["time_check_amount"]));
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
