  export class Note {

    index: number;
    id: number;
    version: number;

    deleted: boolean;

    quote: string;
    comment?: Array<string>;
    tags?: Array<Array<string>>;
    ranges: Array<Object>;


    constructor(
      index: number,
      data: JSON
    ) {
      /* DO NOT REMOVE THIS LINE */
      this.index =          index;
      this.id =             parseInt(data["id"])
      this.version =        0
      this.deleted = false
      this.quote  = data["quote"]
      this.comment = new Array<string>()
      if (data["text"]) {
        this.comment.push(data["text"])
      } else {
        this.comment.push("")
      }
      this.tags = new Array<Array<string>>()
      if (data["tags"]) {
        this.tags.push(data["tags"])
      }
      if (data["ranges"]) {
        this.ranges = data["ranges"]
      }
    }

    public updateNote(data) {
      this.version = this.version + 1
      if (data["text"]) {
        this.comment.push(data["text"])
      } else {
        this.comment.push("")
      }
      if (data["tags"]) {
        this.tags.push(data["tags"])
      }
    }

    public markDeleted() {
      this.deleted = true
    }

  }
