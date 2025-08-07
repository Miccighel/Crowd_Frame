import {Annotator} from "../taskSettings";

export abstract class Note {

    document_index: number;
    attribute_index: number;
    version: number;
    deleted: boolean;
    ignored: boolean;
    color: string;
    container_id: string;
    index_start: number;
    index_end: number;
    timestamp_created: number;
    timestamp_deleted?: number;
    base_uri: string;
    current_text: string
    raw_text: string
    option: string
    text_left: string
    text_right: string
    existing_notes: Array<String>
    serialization: string

    noteType: 'laws' | 'standard';

    annotator: Annotator;

    protected constructor(
        document_index: number,
        attribute_index: number,
        range: JSON,
        data: JSON,
        serialization: string,
        color = "#ffffff"
    ) {
        this.document_index = document_index;
        this.attribute_index = attribute_index;
        this.version = 0
        this.deleted = false
        this.ignored = false
        this.color = color
        this.container_id = ''
        if (range) {
            this.container_id = range["commonAncestorContainer"]["id"]
        }
        this.index_start = 0
        this.index_end = 0
        this.timestamp_created = 0
        if(data)
            this.timestamp_created = parseInt(data[0]["dataset"]["timestamp"])
        this.timestamp_deleted = 0
        this.base_uri = ''
        this.current_text = ''
        if (data) {
            this.timestamp_deleted = parseInt(data[0]["dataset"]["timestamp"])
            this.base_uri = data[0]["baseURI"]
            this.current_text = data[0]["outerText"]
        }
        this.raw_text = this.removeSpecialChars()
        this.option = "not_selected"
        this.text_left = ""
        this.text_right = ""
        this.existing_notes = Array<String>()
        let pieces = []
        if (range) {
            if (range["endContainer"]) {
                Array.from(range["endContainer"]["childNodes"]).forEach((element: HTMLElement) => {
                    if (element.childNodes.length > 0) {
                        for (let i = 0; i < element.childNodes.length; i++) {
                            let childElement: ChildNode = element.childNodes[i]
                            let timestampCreated = parseInt(childElement.parentElement.getAttribute("data-timestamp"))
                            if (this.timestamp_created == timestampCreated) {
                                for (let piece of pieces) this.text_left = this.text_left.concat(piece)
                                pieces = []
                            } else {
                                this.existing_notes.push(childElement.textContent)
                                pieces.push(childElement.textContent)
                            }
                        }
                    } else {
                        pieces.push(element.textContent)
                    }
                })
                for (let piece of pieces) this.text_right = this.text_right.concat(piece)
            }
        }
        this.index_start = this.text_left.length
        this.index_end = this.text_left.length + this.current_text.length
        this.serialization = serialization
        this.noteType = 'standard';
    }

    public restoreData(previousData: Object) {
        this.version = parseInt(previousData['version'])
        this.container_id = previousData['container_id']
        this.timestamp_deleted = parseInt(previousData['timestamp_deleted'])
        this.base_uri = previousData['base_uri']
        this.current_text = previousData['current_text']
        this.deleted = JSON.parse(previousData['deleted'])
        this.ignored = JSON.parse(previousData['ignored'])
        this.color = previousData['color']
        this.container_id = previousData['container_id']
        this.index_start = parseInt(previousData['index_start'])
        this.index_end = parseInt(previousData['index_end'])
        this.timestamp_created = parseInt(previousData['timestamp_created'])
        this.timestamp_deleted = parseInt(previousData['timestamp_deleted'])
        this.base_uri = previousData['base_uri']
        this.current_text = previousData['current_text']
        this.raw_text = previousData['raw_text']
        this.option = previousData['option']
        this.text_left = previousData['text_left']
        this.text_right = previousData['text_right']
        this.existing_notes = previousData['existing_notes']
        this.serialization = previousData['serialization']
    }

    public updateNote() {
        this.version = this.version + 1
    }

    public markDeleted() {
        this.deleted = true
    }

    public removeSpecialChars() {
        let raw_string = this.current_text;
        raw_string = raw_string.replace(/\n|\r/g, " ");
        raw_string = raw_string.replace(/[^a-zA-Z0-9,.'()\[\] ]/g, "");
        let raw_string_single_whitespaces: string = "";
        for (let c = 0; c < raw_string.length; c++) {
            if (c > 0) {
                if (raw_string.charAt(c - 1) == " ") {
                    if (raw_string.charAt(c) != " ") {
                        raw_string_single_whitespaces += raw_string.charAt(c)
                    }
                } else {
                    raw_string_single_whitespaces += raw_string.charAt(c)
                }
            } else {
                raw_string_single_whitespaces += raw_string.charAt(c)
            }
        }
        return raw_string_single_whitespaces
    }
}
