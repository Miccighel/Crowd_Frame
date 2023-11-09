/*
 * This interface provides a representation of the raw response returned by a query to JSON Placeholder posts endpoint.
 * https://jsonplaceholder.typicode.com/posts
 */
export interface FakeSearchResponse {
    userId: string;
    id: string;
    title: string;
    body: string;
}

