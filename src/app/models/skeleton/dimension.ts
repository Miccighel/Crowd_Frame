/*
 * This class provides a representation of a single dimension stored in the Amazon S3 bucket. which must be asked to each worker
 * Each field of such dimensions must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */

export class Dimension {

  index: number;

  name: string;
  name_pretty?: string;
  description?: string;
  justification?: Justification;
  url?: boolean;
  scale?: ScaleCategorical | ScaleInterval | ScaleMagnitude;
  goldQuestionCheck?: boolean;
  style: Style;

  constructor(
    index: number,
    data: JSON
  ) {

    this.index = index;

    this.name =               data["name"];
    this.name_pretty =        data['name_pretty'] ? data["name_pretty"] : null;
    this.description =        data['description'] ? data["description"] : null;
    this.justification =      data['justification'] ? new Justification(data['justification']) : null;
    this.url =                data['url'] ? data["url"] : null;
    this.scale =              data['scale'] ? data['scale']['type'] == "categorical" ? new ScaleCategorical(data['scale']) : new ScaleInterval(data['scale']) : null;
    this.goldQuestionCheck =  data['gold_question_check'] ? data['gold_question_check'] : null;
    this.style =              data['style'] = new Style(data['style']);
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

export class ScaleCategorical extends Scale{

  mappings: Array<Mapping>;

  constructor(
    data: JSON
  ) {

    super(data)

    this.mappings = new Array<Mapping>();
    for (let index = 0; index < data["mapping"].length; index++) this.mappings.push(new Mapping(index, data["mapping"][index]))
  }

}

export class Mapping {

  index: number;

  label: string;
  description: string;
  value: string;

  constructor(
    index: number,
    data: JSON
  ) {

    this.index = index;

    this.label =        data["label"];
    this.description =  data["description"];
    this.value =        data["value"];
  }

}

export class ScaleInterval extends Scale{

  min: number;
  max: number;
  step: number

  constructor(
    data: JSON
  ) {

    super(data)

    this.min =     data['min']
    this.max =     data['max']
    this.step =    data['step']
  }

}

export class ScaleMagnitude extends Scale{

  min: number;
  lower_bound: boolean

  constructor(
    data: JSON
  ) {

    super(data)

    this.min =        data['min']
    this.lower_bound = data['lower_bound']
  }

}

export class Style {

  type: string;
  position: string;
  orientation?: string;
  separator?: string;

  constructor(
    data: JSON
  ) {
    this.type =         data['type']
    this.position =     data['position']
    this.orientation =  data['orientation'] ? data["orientation"] : null;
    this.separator =  data['separator'] ? data["separator"] : null;
  }

}
