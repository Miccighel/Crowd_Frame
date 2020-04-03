/*
 * This interface provides a representation of the raw response returned by a query to fakeJSON.
 * Documentation:
 * https://fakejson.com/documentation#request_structure
 */
export interface FakerSearchResponse {
    url: string;
    name: string;
    text: string;
}

