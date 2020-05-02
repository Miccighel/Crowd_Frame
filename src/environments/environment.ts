export const environment = {

  production: false,

  experimentId: "CrowdsourcingSkeleton",
  subFolder: "",

  scale: "S6",
  allScales: ["S3", "S6", "S100"],
  useEachScale: false,
  allowedTries: 10,

  domainsToFilter: [],

  pastExperiments: [],

  region: 'eu-west-1',
  bucket: 'crowdsourcing-tasks',
  aws_id_key: "AKIAJZPMGNZEXCRQHNGQ",
  aws_secret_key: "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",

};
