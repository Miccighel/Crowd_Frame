export class Settings {

  allowedTries: number;
  timeCheckAmount: number;
  otherBatches: Array<string>;
  messages?: Array<string>;

  constructor(
    data: JSON
  ) {
    this.allowedTries =         parseInt((data["allowed_tries"]));
    this.timeCheckAmount =      parseInt((data["time_check_amount"]));
    this.otherBatches = new Array<string>();
    for (const [_, otherBatch]  of data["other_batches"].entries()) this.otherBatches.push(otherBatch)
    if (data['messages']) {
      this.messages = new Array<string>();
      for (const [_, message] of data["messages"].entries()) this.messages.push(message)
    }
  }

}
