export const environment = {

  production: true,

  experimentId: "MedicalTask",
  subFolder: "Big-1",

  scale: "S6",
  allScales: ["S3", "S6", "S100"],
  useEachScale: false,
  allowedTries: 10,

  domainsToFilter: ["politifact", "poynter", "fullfact"],

  pastExperiments: ["Big-0", "Pilot-0"],

  region: 'eu-west-1',
  bucket: 'crowdsourcing-tasks',
  aws_id_key: "AKIAJZPMGNZEXCRQHNGQ",
  aws_secret_key: "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",

};
