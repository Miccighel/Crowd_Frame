echo "Deploying task ${1}/${2}";
aws s3api put-object     --bucket "${3}" --key "admin.json"                                   --body "tasks/admin.json"                                    --content-type application/json       ;
if [ "${5}" == "allow-config" ]
then
echo "Uploading configuration to folder: ${3}/Task/";
aws s3api put-object     --bucket "${3}" --key "${1}/${2}/Task/dimensions.json"               --body "tasks/${1}/${2}/task/dimensions.json"                --content-type application/json       ;
aws s3api put-object     --bucket "${3}" --key "${1}/${2}/Task/hits.json"                     --body "tasks/${1}/${2}/task/hits.json"                      --content-type application/json       ;
aws s3api put-object     --bucket "${3}" --key "${1}/${2}/Task/instructions_main.json"        --body "tasks/${1}/${2}/task/instructions_main.json"         --content-type application/json       ;
aws s3api put-object     --bucket "${3}" --key "${1}/${2}/Task/instructions_dimensions.json"  --body "tasks/${1}/${2}/task/instructions_dimensions.json"   --content-type application/json       ;
aws s3api put-object     --bucket "${3}" --key "${1}/${2}/Task/questionnaires.json"           --body "tasks/${1}/${2}/task/questionnaires.json"            --content-type application/json       ;
aws s3api put-object     --bucket "${3}" --key "${1}/${2}/Task/search_engine.json"            --body "tasks/${1}/${2}/task/search_engine.json"             --content-type application/json       ;
aws s3api put-object     --bucket "${3}" --key "${1}/${2}/Task/task.json"                     --body "tasks/${1}/${2}/task/task.json"                      --content-type application/json       ;
aws s3api put-object     --bucket "${3}" --key "${1}/${2}/Task/workers.json"                  --body "tasks/${1}/${2}/task/workers.json"                   --content-type application/json       ;
fi
echo "Uploading task source files to folder: ${4}/";
aws s3api put-object     --bucket "${4}" --key "${1}/${2}/styles.css"                         --body "tasks/${1}/${2}/deploy/styles.css"                   --content-type text/css               &&
aws s3api put-object-acl --bucket "${4}" --key "${1}/${2}/styles.css"                         --acl public-read                                                                                  ;
aws s3api put-object     --bucket "${4}" --key "${1}/${2}/scripts.js"                         --body "tasks/${1}/${2}/deploy/scripts.js"                   --content-type application/javascript &&
aws s3api put-object-acl --bucket "${4}" --key "${1}/${2}/scripts.js"                         --acl public-read                                                                                  ;
aws s3api put-object     --bucket "${4}" --key "${1}/${2}/index.html"                         --body "tasks/${1}/${2}/deploy/index.html"                   --content-type text/html              &&
aws s3api put-object-acl --bucket "${4}" --key "${1}/${2}/index.html"                         --acl public-read                                                                                  ;
echo "Upload completed";
