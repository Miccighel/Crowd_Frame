/* JSON REST Response Sample */
/* https://azure.microsoft.com/it-it/services/cognitive-services/bing-web-search-api/ */

export interface BingWebSearchResponse {
  entities: Entities
  images: Images
  news: News
  queryContext: QueryContext
  rankingResponse: RankingResponse
  relatedSearches: RelatedSearches
  webPages: WebPages
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
  mainline: Object
}

export interface RelatedSearches {
  id: string
  value: Array<Object>
}

export interface WebPages {
  totalEstimatedMatches: number
  value: Array<WebPage>
  webSearchUrl: string
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
