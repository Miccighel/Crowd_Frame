export class Document {

		index: number;
		countdownExpired: boolean;
		name_unique: string;
		statement: string;
		speaker: string;
		job: string;
		context: string;
		year: number;
		party: string;
		source: string;
		id: string;

		constructor (
			index: number,
			data: JSON
		) {

			this.index = index
			this.name_unique = data["name_unique"]
			this.statement = data["statement"]
			this.speaker = data["speaker"]
			this.job = data["job"]
			this.context = data["context"]
			this.year = data["year"]
			this.party = data["party"]
			this.source = data["source"]
			this.id = data["id"]

		}

}
