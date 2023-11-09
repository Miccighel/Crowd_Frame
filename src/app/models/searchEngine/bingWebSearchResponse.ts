/*
 * This interface provides a representation of the raw response returned by a request to Bing Web Search.
 * Documentation:
 * https://azure.microsoft.com/it-it/services/cognitive-services/bing-web-search-api/
 */
export interface BingWebSearchResponse {
  entities: Entities
  images: Images
  news: News
  queryContext: QueryContext
  rankingResponse: RankingResponse
  relatedSearches: RelatedSearches
  webPages: WebPages
  clientId: string
  apiMarket: string
  traceId: string
}

export interface Entities {
  value: Array<Object>
}

export interface Images {
  id: string
  isFamilyFriendly: boolean
  readLink: string
  value: Array<Object>
  webSearchUrl: string
}

export interface News {
  id: string
  readLink: string
  value: Array<Object>
}

export interface QueryContext {
  originalQuery: string
}

export interface RankingResponse {
  mainline: Mainline
  sidebar: Sidebar
}

export interface Mainline {
  items: Array<Item>
}

export interface Sidebar {
  items: Array<Item>
}
export interface RelatedSearches {
  id: string
  value: Array<Item>
}

export interface Item {
  answerType: string,
  resultIndex: number,
  value: Object,
}

export interface WebPages {
  totalEstimatedMatches: number
  value: Array<WebPage>
  webSearchUrl: string
  someResultsRemoved: string
}

export interface WebPage {
  dateLastCrawled: string
  displayUrl: string
  id: string
  isFamilyFriendly: boolean
  isNavigational: boolean
  language: string
  name: string
  snippet: string
  url: string
}
