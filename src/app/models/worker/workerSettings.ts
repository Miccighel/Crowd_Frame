export class WorkerSettings {

    block: boolean;
    analysis: boolean;
    blacklist: Array<string>;
    whitelist: Array<string>;
    /* Batches to blacklist */
    blacklist_batches: Array<string>;
    /* Batches to whitelist */
    whitelist_batches: Array<string>;

    constructor(
        data = null as JSON
    ) {
        this.block = data ? 'block' in data ? data['block'] : true : true;
        this.analysis = data ? 'analysis' in data ? data['analysis'] : true : true;
        this.blacklist = new Array<string>();
        if (data) if ('blacklist' in data) for (let workerId of data["blacklist"] as Array<string>) this.blacklist.push(workerId)
        this.whitelist = new Array<string>();
        if (data) if ('whitelist' in data) for (let workerId of data["whitelist"] as Array<string>) this.whitelist.push(workerId)
        this.blacklist_batches = new Array<string>();
        if (data)
            if ('blacklist_batches' in data)
                for (let batch of data["blacklist_batches"] as Array<string>)
                    this.blacklist_batches.push(batch)
        this.whitelist_batches = new Array<string>();
        if (data)
            if ('whitelist_batches' in data)
                for (let batch of data["whitelist_batches"] as Array<string>)
                    this.whitelist_batches.push(batch)
    }

}
