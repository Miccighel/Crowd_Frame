export class Document {

		index: number;
		countdownExpired: boolean;
		name: string;
		statement: string;
		claimant: string;
		date: number;
		originated_from: string;
		id: string;
		job: string;
		party: string;
		source: string;

		constructor (
			index: number,
			data: JSON
		) {

			this.index = index
			this.name = data["name"]
			this.statement = data["statement"]
			this.claimant = data["claimant"]
			this.date = data["date"]
			this.originated_from = data["originated_from"]
			this.id = data["id"]
			this.job = data["job"]
			this.party = data["party"]
			this.source = data["source"]

		}

}
