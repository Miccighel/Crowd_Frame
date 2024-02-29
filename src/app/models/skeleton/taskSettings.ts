import titleize from 'titleize';

export class TaskSettings {

    modality: string;
    /* Number of allowed tries */
    allowed_tries: number;
    time_assessment: number;
    /* Time allowed to be spent on each document */
    time_check_amount
    /* Attribute definition used in the main task interface */
    attributesMain: Array<AttributeMain>
    element_labels?: Object;
    post_assessment: Object;
    /* Attribute definition used to set up the post assessment interface */
    attributesPost: Array<AttributePost>
    dimensionsPost: Array<DimensionPost>
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
        this.time_assessment = data ? parseFloat((data["time_assessment"])) : 2;
        this.time_check_amount = data ? data["time_check_amount"] : 0;
        if (!(typeof this.time_check_amount === 'number') && !this.time_check_amount["default"])
            this.time_check_amount["default"] = 0;
        this.attributesMain = new Array<AttributeMain>()
        if (data) {
            if ('attributes' in data) {
                let attributes = data["attributes"] as Array<JSON>
                for (let index = 0; index < attributes.length; index++) {
                    this.attributesMain.push(new AttributeMain(index, attributes[index]))
                }
            }
            if ('statements' in data) {
                let attributes = data["statements"][0] as Array<JSON>
                for (let index = 0; index < attributes.length; index++) {
                    this.attributesMain.push(new AttributeMain(index, attributes[index]))
                }
            }
        }
        this.post_assessment = data ? 'post_assessment' in data ? data['post_assessment'] : null : null;
        this.attributesPost = new Array<AttributePost>()
        this.dimensionsPost = new Array<DimensionPost>()
        if (this.post_assessment) {
            if ('attributes' in this.post_assessment) {
                let attributes = this.post_assessment["attributes"] as Array<JSON>
                for (let index = 0; index < attributes.length; index++) {
                    this.attributesPost.push(new AttributePost(attributes[index]))
                }
            }
            if ('dimensions' in this.post_assessment) {
                let dimensions = this.post_assessment["dimensions"] as Array<JSON>
                for (let index = 0; index < dimensions.length; index++) {
                    this.dimensionsPost.push(new DimensionPost(dimensions[index]))
                }
            }
        }
        this.element_labels = data ? 'element_labels' in data ? data['element_labels'] : null : null;
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
        this.logger_server_endpoint = data ? 'server_endpoint' in data ? data['server_endpoint'] as string : null : null;
        this.messages = new Array<string>();
        if (data) if ('messages' in data) for (let message of data["messages"] as Array<string>) this.messages.push(message)
    }

}

export class DocumentCategory {

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
    ) {
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

    constructor(
        index: number,
        data: JSON
    ) {
        this.index = index
        this.name = data["name"]
        this.name_pretty = ("name_pretty" in data) ? data["name_pretty"] as string : titleize(data["name"].replace("_", " ")) as string
    }

    public isImage(value: string): boolean {
        /* Check if the attribute name suggests it is an image */
        if (this.name.toLowerCase().includes('image')) {
            /* Check if the value is a URL ending with an image extension */
            return /\.(png|jpe?g|gif|svg)$/i.test(value);
        }
        return false;
    }
}

export class AttributeMain extends Attribute {

    show;
    annotate: boolean;
    required: boolean;

    constructor(
        index: number,
        data: JSON
    ) {
        super(index, data)
        this.show = data["show"] || false;
        this.annotate = data["annotate"];
        this.required = data["required"];
    }

}

export class DimensionPost {

    name: string;
    indexes: Array<number>;

    constructor(
        data: JSON
    ) {
        this.name = data["name"] as string
        this.indexes = new Array<number>();
        if (data) for (let index of data["indexes"] as Array<number>) this.indexes.push(index)
    }

}

export class AttributePost extends Attribute {

    index: number;
    name: string;
    text: string | boolean;

    constructor(
        data: JSON
    ) {
        super(data['index'] as number, data)
        this.name = data["name"] as string
        this.text = ("text" in data) ? data["text"] as string : false
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
