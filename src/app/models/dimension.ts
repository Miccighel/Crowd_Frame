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
  scale?: ScaleCategorical | ScaleInterval | ScaleMagnitude | ScalePairwaise;
  gold?: boolean;
  style: Style;

  constructor(
    index: number,
    data: JSON
  ) {
    this.index = index;

    if('gold_question_check' in data) {
      data['gold'] = data['gold_question_check']
      delete data['gold_question_check']
    }
    this.name =               data["name"];
    this.name_pretty =        data['name_pretty'] ? data["name_pretty"] : null;
    this.description =        data['description'] ? data["description"] : null;
    this.justification =      data['justification'] ? new Justification(data['justification']) : null;
    this.url =                data['url'] ? data["url"] : null;
    if(data['scale']) {
      switch (data['scale']['type']) {
        case 'categorical':
          this.scale = new ScaleCategorical(data['scale'])
          break;
        case 'interval':
          this.scale = new ScaleInterval(data['scale'])
          break;
        case 'magnitude_estimation':
          this.scale = new ScaleMagnitude(data['scale'])
          break;
        case 'pairwaise':
          this.scale=new ScalePairwaise(data['scale'])
          break;
      }
    } else {
      this.scale = null
    }
    this.style =              data['style'] ? new Style(data['style']) : null
    this.gold =               data['gold'] ? data['gold'] : null;

  }

}


export class Justification {

  text: string;
  min_words: number;

  constructor(
    data: JSON
  ) {
    this.text =     data["text"];
    this.min_words = data["min_words"];
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

export class ScalePairwaise extends Scale{
  statements:Array<statement>;
  constructor(
     data:JSON
  ){
     super(data)
     this.statements=new Array<statement>();
     for (let index = 0; index < data["values"].length; index++) this.statements.push(new statement(index, data["values"][index]))
  }
}

export class statement{
    index:number 
    text:string
    speaker:string
    speakerjob:string
    context:string
    constructor(
      index: number,
      data: JSON
    ) {
  
      this.index = index;
  
      this.text =        data["text"];
      this.speaker =  data["speaker"];
      this.speakerjob =        data["speakerjob"];
      this.context=  data["context"];
    }
}
export class ScaleCategorical extends Scale{

  mapping: Array<Mapping>;

  constructor(
    data: JSON
  ) {

    super(data)

    this.mapping = new Array<Mapping>();
    for (let index = 0; index < data["mapping"].length; index++) this.mapping.push(new Mapping(index, data["mapping"][index]))
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
