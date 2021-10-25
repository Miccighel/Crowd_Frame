export class Document {

	index: number;
	countdownExpired: boolean;
	id: string;
	text: string;
	pairwise_split?:boolean;
	statements:Array<statement>;
	constructor (
		index: number,
		data: JSON
	) {

		this.index = index
		this.id = data["id"]
		this.text = data["text"]
		this.pairwise_split=data['pairwise_split']? data["pairwise_split"]: null;
		this.statements=new Array<statement>();
		 for (let index = 0; index < data["statements"].length; index++) this.statements.push(new statement(index, data["statements"][index]))
	}
}
	export class statement{
	index:number;

	name:string;
	statement:string;
	claimant:string;
	date:string;
	originated_from:string;
	id:string;
	job:string;
	party:string;
	source:string;

	constructor(
	index: number,
	data: JSON
	) {
	
		this.index = index;
		
		this.name=data["name"]
		this.statement=data["statement"]
		this.claimant=data["claimant"]
		this.date=data["date"]
		this.originated_from=data["originated_from"]
		this.id=data["id"]
		this.job=data["job"]
		this.party=data["party"]
		this.source=data["source"]
	}
}
