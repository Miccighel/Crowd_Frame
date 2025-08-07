/* Local titleize helper — replaces package 'titleize' */
function titleize(str: string): string {
    return str
        .replace(/_/g, ' ')
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export class TaskSettings {
    modality: string;
    allowed_tries: number;
    time_assessment: number;
    time_check_amount;
    attributesMain: Array<AttributeMain>;
    element_labels?: Object;
    post_assessment: Object;
    attributesPost: Array<AttributePost>;
    dimensionsPost: Array<DimensionPost>;
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

    constructor(data = null as JSON) {
        if (data) {
            if ('domains_to_filter' in data) {
                data['domains_filter'] = data['domains_to_filter'];
                delete data['domains_to_filter'];
            }
        }

        this.modality = data ? data['modality'] : null;
        this.allowed_tries = data ? parseInt(data['allowed_tries']) : 0;
        this.time_assessment = data ? parseFloat(data['time_assessment']) : 2;
        this.time_check_amount = data ? data['time_check_amount'] : 0;
        if (typeof this.time_check_amount !== 'number' && !this.time_check_amount['default']) {
            this.time_check_amount['default'] = 0;
        }

        this.attributesMain = [];
        if (data) {
            if ('attributes' in data) {
                const attributes = data['attributes'] as Array<JSON>;
                for (let index = 0; index < attributes.length; index++) {
                    this.attributesMain.push(new AttributeMain(index, attributes[index]));
                }
            }
            if ('statements' in data) {
                const attributes = data['statements'][0] as Array<JSON>;
                for (let index = 0; index < attributes.length; index++) {
                    this.attributesMain.push(new AttributeMain(index, attributes[index]));
                }
            }
        }

        this.post_assessment = data ? (data['post_assessment'] ?? null) : null;
        this.attributesPost = [];
        this.dimensionsPost = [];

        if (this.post_assessment) {
            if ('attributes' in this.post_assessment) {
                const attributes = this.post_assessment['attributes'] as Array<JSON>;
                for (const attr of attributes) {
                    this.attributesPost.push(new AttributePost(attr));
                }
            }
            if ('dimensions' in this.post_assessment) {
                const dimensions = this.post_assessment['dimensions'] as Array<JSON>;
                for (const dim of dimensions) {
                    this.dimensionsPost.push(new DimensionPost(dim));
                }
            }
        }

        this.element_labels = data ? data['element_labels'] ?? null : null;
        this.annotator = data && data['annotator'] ? new Annotator(data['annotator']) : null;
        this.countdownTime = data && data['countdown_time'] >= 0 ? parseInt(data['countdown_time']) : null;
        this.countdown_behavior = data ? data['countdown_behavior'] ?? null : null;
        this.countdown_modality = data ? data['countdown_modality'] ?? null : null;
        this.countdown_attribute = data ? data['countdown_attribute'] ?? null : null;

        this.countdown_attribute_values = [];
        if (data && 'countdown_attribute_values' in data) {
            for (const value of data['countdown_attribute_values'] as Array<JSON>) {
                this.countdown_attribute_values.push(value);
            }
        }

        this.countdown_position_values = [];
        if (data && 'countdown_position_values' in data) {
            for (const value of data['countdown_position_values'] as Array<JSON>) {
                this.countdown_position_values.push(value);
            }
        }

        this.logger_enable = data ? !!data['logger'] : false;
        this.logger_options = data
            ? data['logger_option'] ?? {
            button: {general: 'false', click: 'false'},
            mouse: {general: 'false', mouseMovements: 'false', leftClicks: 'false', rightClicks: 'false'},
            keyboard: {general: 'false', shortcuts: 'false', keys: 'false'},
            textInput: {general: 'false', paste: 'false', delete: 'false'},
            clipboard: {general: 'false', copy: 'false', cut: 'false'},
            radio: {general: 'false', change: 'false'},
            'search-engine-body': {general: 'false', query: 'false', result: 'false'},
            various: {general: 'false', selection: 'false', unload: 'false', 'focus&blur': 'false', scroll: 'false', resize: 'false'}
        }
            : {};

        this.logger_server_endpoint = data ? data['server_endpoint'] ?? null : null;

        this.messages = [];
        if (data && 'messages' in data) {
            for (const message of data['messages'] as Array<string>) {
                this.messages.push(message);
            }
        }
    }
}

export class DocumentCategory {
    name: string;
    name_pretty: string;
    values_number: number;
    selected: boolean;
    worker_assignment: number;

    constructor(name: string, values_number: number, worker_assignment: number, selected?: boolean, name_pretty?: string) {
        this.name = name;
        this.name_pretty = name_pretty ?? titleize(name);
        this.values_number = values_number;
        this.selected = selected ?? false;
        this.worker_assignment = worker_assignment;
    }
}

export class Attribute {
    index: number;
    name: string;
    name_pretty: string;
    is_video: boolean;

    constructor(index: number, data: JSON) {
        this.index = index;
        this.name = data['name'];
        this.name_pretty = data['name_pretty'] || titleize(this.name);

        /* unified video detection */
        if ('is_video' in data) {
            this.is_video = !!data['is_video'];
        } else {
            this.is_video = false;
        }
    }

    public isImage(v: string): boolean {
        return this.name.toLowerCase().includes('image') && /\.(png|jpe?g|gif|svg)$/i.test(v);
    }
}

export class AttributeMain extends Attribute {
    show: boolean | string[]
    annotate: boolean;
    required: boolean;

    constructor(index: number, data: JSON) {
        super(index, data);
        this.show = data['show'];
        this.annotate = !!data['annotate'];
        this.required = !!data['required'];
    }
}


export class DimensionPost {
    name: string;
    indexes: Array<number>;

    constructor(data: JSON) {
        this.name = data['name'] as string;
        this.indexes = [];
        for (const index of data['indexes'] as Array<number>) {
            this.indexes.push(index);
        }
    }
}

export class AttributePost extends Attribute {
    override index: number;
    override name: string;
    text: string | boolean;

    constructor(data: JSON) {
        super(data['index'] as number, data);
        this.name = data['name'] as string;
        this.text = 'text' in data ? data['text'] as string : false;
    }
}

export class Annotator {
    type: string;
    values?: Array<Object>;

    constructor(data: JSON) {
        this.type = data['type'];
        this.values = data['values'] ? data['values'] : null;
    }
}
