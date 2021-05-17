export class Document {

		index: number;
		countdownExpired: boolean;
id: string;
text: string;
adr_spans: Array<JSON>;
adr_text: Array<JSON>;
drug_spans: Array<JSON>;
drug_text: Array<JSON>;
url: string;
constructor (
index: number,
data: JSON
) {
this.index = index
this.id = data["id"]
this.text = data["text"]
for (let index = 0; index < data["adr_spans"].length; index++) this.adr_spans.push(data["adr_spans"][index])
for (let index = 0; index < data["adr_text"].length; index++) this.adr_text.push(data["adr_text"][index])
for (let index = 0; index < data["drug_spans"].length; index++) this.drug_spans.push(data["drug_spans"][index])
for (let index = 0; index < data["drug_text"].length; index++) this.drug_text.push(data["drug_text"][index])
this.url = data["url"]
}
}
