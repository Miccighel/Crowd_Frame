export class SettingsWorker {

  blacklist: Array<string>;
  whitelist: Array<string>;

  constructor(
    data = null as JSON
  ) {
    this.blacklist = new Array<string>();
    if(data) for (let workerId of data["blacklist"]) this.blacklist.push(workerId)
    this.whitelist = new Array<string>();
    if(data) for (let workerId of data["whitelist"]) this.whitelist.push(workerId)
  }

}
