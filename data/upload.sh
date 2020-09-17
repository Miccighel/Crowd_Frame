aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/dimensions.json         --body tasks/Sample/Batch-1/task/dimensions.json                --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/hits.json               --body tasks/Sample/Batch-1/task/hits.json                      --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/instructions.html       --body tasks/Sample/Batch-1/task/instructions.html              --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/instructions.json       --body tasks/Sample/Batch-1/task/instructions.json              --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/questionnaires.json     --body tasks/Sample/Batch-1/task/questionnaires.json            --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/search_engine.json      --body tasks/Sample/Batch-1/task/search_engine.json             --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/task.json               --body tasks/Sample/Batch-1/task/task.json                      --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-tasks-us  --key Sample/Batch-1/Task/workers.json            --body tasks/Sample/Batch-1/task/workers.json                   --content-type application/json       &&
aws s3api put-object     --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task.css       --body tasks/Sample/Batch-1/deploy/crowdsourcing-task.css       --content-type text/css               &&
aws s3api put-object     --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task-es5.js    --body tasks/Sample/Batch-1/deploy/crowdsourcing-task-es5.js    --content-type application/javascript &&
aws s3api put-object     --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task-es2015.js --body tasks/Sample/Batch-1/deploy/crowdsourcing-task-es2015.js --content-type application/javascript &&
aws s3api put-object     --bucket crowdsourcing-deploy-us --key Sample/Batch-1/index.html                   --body tasks/Sample/Batch-1/deploy/index.html                   --content-type text/html              &&
aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task.css       --acl public-read                                                                                            &&
aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task-es5.js    --acl public-read                                                                                            &&
aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key Sample/Batch-1/crowdsourcing-task-es2015.js --acl public-read                                                                                            &&
aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key Sample/Batch-1/index.html                   --acl public-read

#deploy=""
#
#for arg in "$@"
#do
#    case $arg in
#        -d|--deploy)
#        deploy="$2"
#        shift # Remove argument name from processing
#        shift # Remove argument value from processing
#        ;;
#    esac
#done
#
#echo "Deploy task $deploy"
#
#aws s3api put-object     --bucket crowdsourcing-tasks-us  --key "${deploy}/Task/dimensions.json"         --body "tasks/${deploy}/task/dimensions.json"                 --content-type application/json       &&
#aws s3api put-object     --bucket crowdsourcing-tasks-us  --key "${deploy}/Task/hits.json"               --body "tasks/${deploy}/task/hits.json"                       --content-type application/json       &&
#aws s3api put-object     --bucket crowdsourcing-tasks-us  --key "${deploy}/Task/instructions.html"       --body "tasks/${deploy}/task/instructions.html"               --content-type application/json       &&
#aws s3api put-object     --bucket crowdsourcing-tasks-us  --key "${deploy}/Task/questionnaires.json"     --body "tasks/${deploy}/task/questionnaires.json"             --content-type application/json       &&
#aws s3api put-object     --bucket crowdsourcing-tasks-us  --key "${deploy}/Task/search_engine.json"      --body "tasks/${deploy}/task/search_engine.json"              --content-type application/json       &&
#aws s3api put-object     --bucket crowdsourcing-tasks-us  --key "${deploy}/Task/task.json"               --body "tasks/${deploy}/task/task.json"                       --content-type application/json       &&
#aws s3api put-object     --bucket crowdsourcing-tasks-us  --key "${deploy}/Task/workers.json"            --body "tasks/${deploy}/task/workers.json"                    --content-type application/json       &&
#aws s3api put-object     --bucket crowdsourcing-deploy-us --key "${deploy}/crowdsourcing-task.css"       --body "tasks/${deploy}/deploy/crowdsourcing-task.css"        --content-type text/css               &&
#aws s3api put-object     --bucket crowdsourcing-deploy-us --key "${deploy}/crowdsourcing-task-es5.js"    --body "tasks/${deploy}/deploy/crowdsourcing-task-es5.js"     --content-type application/javascript &&
#aws s3api put-object     --bucket crowdsourcing-deploy-us --key "${deploy}/crowdsourcing-task-es2015.js" --body "tasks/${deploy}/deploy/crowdsourcing-task-es2015.js"  --content-type application/javascript &&
#aws s3api put-object     --bucket crowdsourcing-deploy-us --key "${deploy}/index.html"                   --body "tasks/${deploy}/deploy/index.html"                   --content-type text/html              &&
#aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key "${deploy}/crowdsourcing-task.css"       --acl public-read                                                                                   &&
#aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key "${deploy}/crowdsourcing-task-es5.js"    --acl public-read                                                                                   &&
#aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key "${deploy}/crowdsourcing-task-es2015.js" --acl public-read                                                                                   &&
#aws s3api put-object-acl --bucket crowdsourcing-deploy-us --key "${deploy}/index.html"                   --acl public-read
