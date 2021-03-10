/*
 * This interface provides a representation of a single Hit stored on in the Amazon S3 bucket.
 * Each field of such Hit must be mapped to an attribute of this interface.
 */

export interface Hit {

  unit_id: string
  token_input: string
  token_output: string
  documents_number: number
  documents: Array<JSON>

}
