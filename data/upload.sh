aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/dimensions.json         --body debug/dimensions.json                --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/hits.json               --body debug/hits.json                      --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/instructions.html       --body debug/instructions.html              --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/instructions.json       --body debug/instructions.json              --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/questionnaires.json     --body debug/questionnaires.json            --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/search_engine.json      --body debug/search_engine.json             --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/task.json               --body debug/task.json                      --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/workers.json            --body debug/workers.json                   --content-type application/json       &&
aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task.css       --acl public-read                                                                 &&
aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task-es5.js    --acl public-read                                                                 &&
aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task-es2015.js --acl public-read                                                                 &&
aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key Sample/Batch-1/index.html                   --acl public-read
