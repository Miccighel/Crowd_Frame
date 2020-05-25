/*
 * This class provides a representation of a single dimension which must be asked to each worker stored in the Amazon S3 bucket.
 * Each field of such dimensions must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */

export class Dimension {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  name: string;
  description: string;
  justification?: Justification;
  url?: boolean;
  scale?: ScaleDiscrete | ScaleContinue;
  goldQuestionCheck?: boolean;
  style: Style;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.name =               data["name"];
    this.description =        data["description"];
    this.justification =      data['justification'] ? new Justification(data['justification']) : null;
    this.url =                data['url'] ? data["url"] : null;
    this.scale =              data['scale'] ? data['scale']['type'] == "discrete" ? new ScaleDiscrete(data['scale']) : new ScaleContinue(data['scale']) : null;
    this.goldQuestionCheck =  data['gold_question_check'] ? data['gold_question_check'] : null;
    this.style =              data['justification'] = new Style(data['style']);
  }

}

export class Justification {

  text: string;
  minWords: number;

  constructor(
    data: JSON
  ) {
    this.text =     data["text"];
    this.minWords = data["min_words"];
  }

}


export class Scale {

  type: string;

  constructor(
    data: JSON
  ) {
    this.type = data["type"];
  }

}

export class ScaleDiscrete extends Scale{

  mappings: Array<Mapping>;

  constructor(
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    super(data)

    this.mappings = new Array<Mapping>();
    for (let index = 0; index < data["mapping"].length; index++) this.mappings.push(new Mapping(index, data["mapping"][index]))
  }

}

export class Mapping {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  label: string;
  description: string;
  value: string;


  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.label =        data["label"];
    this.description =  data["description"];
    this.value =        data["value"];
  }

}

export class ScaleContinue extends Scale{

  min: number;
  max: number;
  step: number

  constructor(
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    super(data)

    this.min =     data['min']
    this.max =     data['max']
    this.step =    data['step']
  }

}

export class Style {

  type: string;
  position: string;
  orientation?: string;

  constructor(
    data: JSON
  ) {
    this.type =         data['type']
    this.position =     data['position']
    this.orientation =  data['orientation'] ? data["orientation"] : null;
  }

}
