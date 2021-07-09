export class SettingsWorker {

  blacklist: Array<string>;
  whitelist: Array<string>;

  constructor(
    data = null as JSON
  ) {
    this.blacklist = new Array<string>();
    if(data) if('blacklist' in data) for (let workerId of data["blacklist"] as Array<string>) this.blacklist.push(workerId)
    this.whitelist = new Array<string>();
    if(data) if('whitelist' in data) for (let workerId of data["whitelist"] as Array<string>) this.whitelist.push(workerId)
  }

}
