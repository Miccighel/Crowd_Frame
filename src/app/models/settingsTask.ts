import titleize from 'titleize';

export class SettingsTask {

  modality: string;
    allowed_tries: number;
    time_check_amount: number;
    attributes: Array<Attribute>
    annotator?: Annotator;
    countdown_time?: number;
    countdown_behavior?: string;
    countdown_modality?: string;
    countdown_attribute?: string;
    countdown_attribute_values?: Array<JSON>;
    countdown_position_values?: Array<number>;
    messages?: Array<string>;
    log_enable?: boolean;
    log_option?: Object;
    log_server_endpoint?: string;

    constructor(
        data = null as JSON
    ) {
        if (data) {
            if ('domains_to_filter' in data) {
                data['domains_filter'] = data['domains_to_filter']
                delete data['domains_to_filter']
            }
        }
        this.modality =  data ? data['modality'] : null;
        this.allowed_tries = data ? parseInt((data["allowed_tries"])) : 0;
        this.time_check_amount = data ? parseInt((data["time_check_amount"])) : 0;
        this.attributes = new Array<Attribute>()
        if (data) {
            if ('attributes' in data) {
                let attributes = data["attributes"] as Array<JSON>
                for (let index = 0; index < attributes.length; index++) {
                    this.attributes.push(new Attribute(index, attributes[index]))
                }
            }
            if ('statements' in data) {
                let attributes = data["statements"][0] as Array<JSON>
                for (let index = 0; index < attributes.length; index++) {
                    this.attributes.push(new Attribute(index, attributes[index]))
                }
            }
        }
        this.annotator = data ? data["annotator"] ? new Annotator(data["annotator"]) : null : null;
        this.countdown_time = data ? data["countdown_time"] >= 0 ? parseInt((data["countdown_time"])) : null : null;
        this.countdown_behavior = data ? data["countdown_behavior"] ? data['countdown_behavior'] : null : null;
        this.countdown_modality = data ? data["countdown_modality"] ? data['countdown_modality'] : null : null;
        this.countdown_attribute = data ? data["countdown_attribute"] ? data['countdown_attribute'] : null : null;
        this.countdown_attribute_values = new Array<JSON>()
        if (data) if ('countdown_attribute_values' in data) for (let value of data["countdown_attribute_values"] as Array<JSON>) this.countdown_attribute_values.push(value)
        this.log_enable = data ? !!data["logger"] : false;
        this.log_option = data ? data['logOption'] ? data['logOption'] : {
            "button": {
                "general": 'false',
                "click": 'false'
            },
            "mouse": {
                "general": 'false',
                "mouseMovements": 'false',
                "leftClicks": 'false',
                "rightClicks": 'false'
            },
            "keyboard": {
                "general": 'false',
                "shortcuts": 'false',
                "keys": 'false'
            },
            "textInput": {
                "general": 'false',
                "paste": 'false',
                "delete": 'false'
            },
            "clipboard": {
                "general": 'false',
                "copy": 'false',
                "cut": 'false'
            },
            "radio": {
                "general": 'false',
                "change": 'false'
            },
            "crowd-xplorer": {
                "general": 'false',
                "query": 'false',
                "result": 'false'
            },
            "various": {
                "general": 'false',
                "selection": 'false',
                "unload": 'false',
                "focus&blur": 'false',
                "scroll": 'false',
                "resize": 'false'
            }
        } : {};
        this.log_server_endpoint = data ? data['serverEndpoint'] ? data['serverEndpoint'] : "" : "";
        this.messages = new Array<string>();
        if (data) if (data['messages']) for (let message of data["messages"]) this.messages.push(message)
    }

}

export class DocCategory {
    
    name: string;
    name_pretty: string;
    values_number: number;
    selected: boolean;
    worker_assignment: number;

    constructor(
        name: string,
        values_number: number,
        worker_assignment: number,
        selected?: boolean,
        name_pretty?: string,
    ){
        this.name = name
        this.name_pretty = name_pretty ? name_pretty : titleize(name.replace("_", " "))
        this.values_number = values_number
        this.selected = selected ? selected : false;
        this.worker_assignment = worker_assignment
    }
}

export class Attribute {

    index: number;
    name: string;
    name_pretty: string;
    show: boolean;
    annotate: boolean;
    required: boolean;

    constructor(
        index: number,
        data: JSON
    ) {
        this.index = index
        this.name = data["name"]
        this.name_pretty = ("name_pretty" in data) ? data["name_pretty"] : titleize(data["name"].replace("_", " "))
        this.show = data["show"];
        this.annotate = data["annotate"];
        this.required = data["required"];
    }

}

export class Annotator {

    type: string;
    values?: Array<Object>

    constructor(
        data: JSON
    ) {
        this.type = data["type"];
        this.values = data["values"] ? data["values"] : null;
    }

}
