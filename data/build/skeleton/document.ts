export class Document {

		index: number;
		countdownExpired: boolean;
		id: string;
		text: string;

		constructor (
			index: number,
			data: JSON
		) {

			this.index = index
			this.id = data["id"]
			this.text = data["text"]

		}

}
