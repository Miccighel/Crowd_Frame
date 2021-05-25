export class Document {

		index: number;
		countdownExpired: boolean;
		filename: string;
		title: string;
		subject: string;
		type: string;
		number: string;
		year: string;
		editorial_code: string;
		gazette_reference: string;
		publication_date: string;
		gazette_date: string;
		valid_from: string;
		last_updated: string;
		link_gazette: string;
		link_urn_nir: string;
		link_eli_id: string;
		link_eli_type: string;
		article_id: string;
		article_number: string;
		article_text: Array<JSON>;

		constructor (

			index: number,
			data: JSON

		) {

			this.index = index
			this.filename = data["filename"]
			this.title = data["title"]
			this.subject = data["subject"]
			this.type = data["type"]
			this.number = data["number"]
			this.year = data["year"]
			this.editorial_code = data["editorial_code"]
			this.gazette_reference = data["gazette_reference"]
			this.publication_date = data["publication_date"]
			this.gazette_date = data["gazette_date"]
			this.valid_from = data["valid_from"]
			this.last_updated = data["last_updated"]
			this.link_gazette = data["link_gazette"]
			this.link_urn_nir = data["link_urn_nir"]
			this.link_eli_id = data["link_eli_id"]
			this.link_eli_type = data["link_eli_type"]
			this.article_id = data["article_id"]
			this.article_number = data["article_number"]
			for (let index = 0; index < data["article_text"].length; index++)
			this.article_text.push(data["article_text"][index])

		}

}
