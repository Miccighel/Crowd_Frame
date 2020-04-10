/*
 * This class provides...
 */
export class Questionnaire {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  type: string;
  questions: Array<Question>;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.type = data["type"];
    this.questions = new Array<Question>();
    for (let index = 0; index < data["questions"].length; index++) this.questions.push(new Question(index, data["questions"][index]))
  }

}

export class Question {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  name: string;
  text: string;
  answers: Array<string>;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.name = data["name"];
    this.text = data["text"];
    this.answers = new Array<string>();
    for (const [_, answer] of data["answers"].entries()) this.answers.push(answer)
  }

}
