export class Document {

		index: number;
		countdownExpired: boolean;
		id: string;
		statement: string;
		claimant: string;
		date: string;
		originated_from: string;

		constructor (
			index: number,
			data: JSON
		) {

			this.index = index
			this.id = data["id"]
			this.statement = data["statement"]
			this.claimant = data["claimant"]
			this.date = data["date"]
			this.originated_from = data["originated_from"]

		}

}
