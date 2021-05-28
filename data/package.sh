#!/bin/sh

echo "Creating folder: tasks/${1}/${2}/deploy";
mkdir -p "tasks/${1}/${2}/deploy";
echo "Creating folder: tasks/${1}/${2}/mturk";
mkdir -p "tasks/${1}/${2}/mturk";
# shellcheck disable=SC2039
if [ "$3" == "allow-config" ]
then
echo "Creating folder: tasks/${1}/${2}/task";
mkdir -p "tasks/${1}/${2}/task";
fi
echo "Building task ${1}/${2}";
ng build --configuration="production" --output-hashing=none \
&& cat ../dist/CrowdsourcingSkeleton/polyfills.js ../dist/CrowdsourcingSkeleton/runtime.js ../dist/CrowdsourcingSkeleton/main.js > build/deploy/scripts.js  \
&& cat ../dist/CrowdsourcingSkeleton/styles.css > build/deploy/styles.css \
&& cat build/deploy/scripts.js > "tasks/${1}/${2}/deploy/scripts.js" \
&& cat build/deploy/styles.css > "tasks/${1}/${2}/deploy/styles.css" \
&& cat build/deploy/index.html > "tasks/${1}/${2}/deploy/index.html" \
&& cat build/admin.json > "tasks/admin.json" \
&& cat build/task/workers.json > "tasks/${1}/${2}/task/workers.json" \
&& cat build/mturk/tokens.csv > "tasks/${1}/${2}/mturk/tokens.csv" \
&& cat build/mturk/index.html > "tasks/${1}/${2}/mturk/index.html";
# shellcheck disable=SC2039
if [ "$3" == "allow-config" ]
then
cat build/task/dimensions.json > "tasks/${1}/${2}/task/dimensions.json";
cat build/task/hits.json > "tasks/${1}/${2}/task/hits.json";
cat build/task/instructions_main.json > "tasks/${1}/${2}/task/instructions_main.json";
cat build/task/instructions_dimensions.json > "tasks/${1}/${2}/task/instructions_dimensions.json";
cat build/task/questionnaires.json > "tasks/${1}/${2}/task/questionnaires.json";
cat build/task/search_engine.json > "tasks/${1}/${2}/task/search_engine.json";
cat build/task/task.json > "tasks/${1}/${2}/task/task.json";
cat build/task/workers.json > "tasks/${1}/${2}/task/workers.json";
fi
echo "Build completed";
