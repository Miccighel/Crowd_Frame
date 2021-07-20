export class Document {
    index: number;
    id: string;
    statement: string;
    claimant: string;
    date: string;
    originated_from: string;
    time: number;

    constructor(index: number, data: JSON) {
        this.id = data["id"];
        this.statement = data["statement"];
        this.claimant = data["claimant"];
        this.date = data["date"];
        this.originated_from = data["originated_from"];
        this.time = data['time']
    }
}
