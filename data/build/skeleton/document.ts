export class Document {

		index: number;
		countdownExpired: boolean;
		id: string;
		text: string;
		statements:Array<statement>;
		constructor (
			index: number,
			data: JSON
		) {

			this.index = index
			this.id = data["id"]
			this.text = data["text"]
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
    value:number;
    constructor(
      index: number,
      data: JSON
    ) {
  
      this.index = index;
  
      this.text =data["text"];
      this.speaker =  data["speaker"];
      this.speakerjob = data["speakerjob"];
      this.context=  data["context"];
      this.value=data["value"];
    }
}