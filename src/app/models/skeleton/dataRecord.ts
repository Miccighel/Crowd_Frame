export class DataRecord {

    identifier: string
    sequence: string
    index: number
    sequenceNumber: number
    tryCurrent: number
    access: number
    action: string
    time: Date
    element: string
    data: Object
    unitId: string
    constructor(rawRecord: JSON) {
        this.identifier = rawRecord['identifier']
        this.sequence = rawRecord['sequence']
        this.index = parseInt(rawRecord['index'])
        this.sequenceNumber = parseInt(rawRecord['sequence_number'])
        this.tryCurrent = parseInt(rawRecord['try'])
        this.access = parseInt(rawRecord['access'])
        this.action = rawRecord['action']
        this.time = new Date(rawRecord['time']);
        this.element = rawRecord['element']
        this.data = rawRecord['data']
        let sequenceParts = this.sequence.split("-")
        for (let sequencePart of sequenceParts) {
            if (sequencePart.includes('unit'))
                this.unitId = sequencePart
        }
    }

    public loadSearchEngineQueries() {
        return this.data['queries']
    }

    public loadSearchEngineRetrievedResponses() {
        return this.data['responses_retrieved']
    }

    public loadSearchEngineSelectedResponses() {
        return this.data['responses_selected']
    }

    public loadDimensionsSelected() {
        return this.data['dimensions_selected']
    }

    public loadTimestampsStart() {
        return this.data['timestamps_start']
    }

    public loadTimestampsEnd() {
        return this.data['timestamps_end']
    }

    public loadTimestampsElapsed() {
        return this.data['timestamps_elapsed']
    }

    public loadAnswers() {
        return this.data['answers']
    }

    public loadAccesses() {
        return this.data['accesses']
    }

}
