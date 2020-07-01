/*
 * This class provides a representation of a single questionnaire stored in the Amazon S3 bucket.
 * The attribute <index> is additional and should not be touched and passed in the constructor.
 * Each field of such Questionnaire must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */
export class Questionnaire {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  type: string;
  description?: string;
  questions: Array<Question>;
  mappings: Array<Mapping>;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.description =  data['description'] ? data["description"] : null;
    this.type = data["type"];
    this.questions = new Array<Question>();
    for (let index = 0; index < data["questions"].length; index++) this.questions.push(new Question(index, data["questions"][index]))
    if(data['mapping']) {
      this.mappings = new Array<Mapping>();
      for (let index = 0; index < data["mapping"].length; index++) this.mappings.push(new Mapping(index, data["mapping"][index]))
    }
  }

}

export class Question {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  name: string;
  text?: string;
  answers?: Array<string>;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.name = data["name"];
    this.text = data['text'] ? data["text"] : null;
    if (data['answers']) {
      this.answers = new Array<string>();
      for (const [_, answer] of data["answers"].entries()) this.answers.push(answer)
    }
  }

}

export class Mapping {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  label: string;
  value: string;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.label =        data["label"];
    this.value =        data["value"];
  }

}
