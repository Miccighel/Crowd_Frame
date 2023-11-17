import titleize from 'titleize';

export class TaskSettings {

    modality: string;
    /* Number of allowed tries */
    allowed_tries: number;
    time_assessment: number;
    /* Time allowed to be spent on each document */
    time_check_amount: number;
    attributes: Array<Attribute>
    /* Object to encapsulate annotator's settings */
    annotator?: Annotator;
    countdownTime?: number;
    countdown_behavior?: string;
    countdown_modality?: string;
    countdown_attribute?: string;
    countdown_attribute_values?: Array<JSON>;
    countdown_position_values?: Array<JSON>;
    messages?: Array<string>;
    logger_enable?: boolean;
    logger_options?: Object;
    logger_server_endpoint?: string;

    constructor(
        data = null as JSON
    ) {
        if (data) {
            if ('domains_to_filter' in data) {
                data['domains_filter'] = data['domains_to_filter']
                delete data['domains_to_filter']
            }
        }
        this.modality = data ? data['modality'] : null;
        this.allowed_tries = data ? parseInt((data["allowed_tries"])) : 0;
        this.time_assessment = data ? parseInt((data["time_assessment"])) : 2;
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
        this.annotator = data ? data['annotator'] ? new Annotator(data["annotator"]) : null : null;
        this.countdownTime = data ? data["countdown_time"] >= 0 ? parseInt((data["countdown_time"])) : null : null;
        this.countdown_behavior = data ? 'countdown_behavior' in data ? data['countdown_behavior'] as string : null : null;
        this.countdown_modality = data ? 'countdown_modality' in data ? data['countdown_modality'] as string : null : null;
        this.countdown_attribute = data ? 'countdown_attribute' in data ? data['countdown_attribute'] as string : null : null;
        this.countdown_attribute_values = new Array<JSON>()
        if (data) if ('countdown_attribute_values' in data) for (let value of data["countdown_attribute_values"] as Array<JSON>) this.countdown_attribute_values.push(value)
        this.countdown_position_values = new Array<JSON>()
        if (data) if ('countdown_position_values' in data) for (let value of data["countdown_position_values"] as Array<JSON>) this.countdown_position_values.push(value)
        this.logger_enable = data ? !!data["logger"] : false;
        this.logger_options = data ? data['logger_option'] ? data['logger_option'] : {
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
            "search-engine-body": {
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
        this.logger_server_endpoint = data ? 'server_endpoint' in data ? data['server_endpoint'] as string : null: null;
        this.messages = new Array<string>();
        if (data) if ('messages' in data) for (let message of data["messages"] as Array<string>) this.messages.push(message)
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
    show;
    annotate: boolean;
    required: boolean;

    constructor(
        index: number,
        data: JSON
    ) {
        this.index = index
        this.name = data["name"]
        this.name_pretty = ("name_pretty" in data) ? data["name_pretty"] as string : titleize(data["name"].replace("_", " ")) as string
        this.show = data["show"] || false;
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
