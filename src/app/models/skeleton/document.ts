export class Document {

  index: number;

  id_par: string;
  name_unique: string;
  statement: string;
  speaker: string;
  job: string;
  context: string;
  year: string;
  party: string;
  source: string;

  constructor(
    index: number,
    data: JSON
  ) {
    this.index =        index;
    this.id_par =       data["id_par"];
    this.name_unique =  data["name_unique"];
    this.statement =    data["statement"];
    this.speaker =      data["speaker"];
    this.job =          data["job"];
    this.context =      data["context"];
    this.year =         data["year"];
    this.party =        data["party"];
    this.source =       data["source"];
  }

  public getGoldQuestionIndex(kind: string) {
    if (this.id_par == kind) return this.index
  }

}
