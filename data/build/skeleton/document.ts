export class Document {

	index: number;
	countdownExpired: boolean;
	id: string;
	text: string;
	pairwise_selection?:boolean;
	pairwise_split?:boolean;
	statements:Array<statement>;
	constructor (
		index: number,
		data: JSON
	) {

		this.index = index
		this.id = data["id"]
		this.text = data["text"]
		this.pairwise_selection=data['pairwise_selection']? data["pairwise_selection"]: null;
		this.pairwise_split=data['pairwise_split']? data["pairwise_split"]: null;
		this.statements=new Array<statement>();
		 for (let index = 0; index < data["statements"].length; index++) this.statements.push(new statement(index, data["statements"][index]))
	}
}
	export class statement{
	index:number;
	text:string;
	speaker:string;
	speakerjob:string;
	context:string;
	constructor(
	index: number,
	data: JSON
	) {
	
		this.index = index;
		
		this.text =data["text"];
		this.speaker =  data["speaker"];
		this.speakerjob = data["speakerjob"];
		this.context=  data["context"];
	}
}

