export class Document {

		index: number;
		countdownExpired: boolean;
		id: string;
		text: string;
		pairwise_split: number;
		statements: Array<String>;

		constructor (
			index: number,
			data: JSON
		) {

			this.index = index
			this.id = data["id"]
			this.text = data["text"]
			this.pairwise_split = data["pairwise_split"]
			this.statements = new Array<String>()
			for (let index = 0; index < data["statements"].length; index++)
			this.statements.push(data["statements"])

		}

}
