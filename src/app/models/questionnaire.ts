export class Questionnaire {

  index: number;

  type: string;
  description?: string;
  position?: string;
  questions: Array<Question>;
  mappings: Array<Mapping>;

  constructor(
    index: number,
    data: JSON
  ) {

    this.index = index;

    this.description =  data['description'] ? data["description"] : null;
    this.position =  data['position'] ? data["position"] : null;
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
  detail?: Detail;
  showDetail: boolean

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
    this.detail = data['detail'] ? new Detail(data["detail"]) : null;
    this.showDetail = false

  }

}

export class Detail {

  text: string;
  elements: Array<Element>

  constructor(
    data: JSON
  ) {

    this.text = data["text"];
    this.elements = new Array<Element>();
    for (let index = 0; index < data["elements"].length; index++) this.elements.push(new Element(index, data["elements"][index]))

  }

}

export class Element {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  key: string;
  items: Array<string>;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.key = data['key'];
    this.items = new Array<string>();
    for (const [_, item] of data["items"].entries()) this.items.push(item)

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
