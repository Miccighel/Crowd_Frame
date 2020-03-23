export class Document {

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
    id_par: string,
    name_unique: string,
    statement: string,
    speaker: string,
    job: string,
    context: string,
    year: string,
    party: string,
    source: string
  ) {
    this.id_par = id_par;
    this.name_unique = name_unique;
    this.statement = statement;
    this.speaker = speaker;
    this.job = job;
    this.context = context;
    this.year = year;
    this.party = party;
    this.source = source;
  }

}
