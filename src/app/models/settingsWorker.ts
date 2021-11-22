export class SettingsWorker {

  block: boolean;
  analysis: boolean;
  blacklist: Array<string>;
  whitelist: Array<string>;

  constructor(
    data = null as JSON
  ) {
    this.block = data ? data["block"] ? data['block'] : true : true;
    this.analysis = data ? data["analysis"] ? data['analysis'] : true : true;
    this.blacklist = new Array<string>();
    if(data) if('blacklist' in data) for (let workerId of data["blacklist"] as Array<string>) this.blacklist.push(workerId)
    this.whitelist = new Array<string>();
    if(data) if('whitelist' in data) for (let workerId of data["whitelist"] as Array<string>) this.whitelist.push(workerId)
  }

}
