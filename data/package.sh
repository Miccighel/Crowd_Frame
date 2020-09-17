#!/bin/sh

ng build --prod --output-hashing=none && \
cat ../dist/CrowdsourcingSkeleton/polyfills-es2015.js ../dist/CrowdsourcingSkeleton/runtime-es2015.js ../dist/CrowdsourcingSkeleton/main-es2015.js > build/crowdsourcing-task-es2015.js && \
cat ../dist/CrowdsourcingSkeleton/polyfills-es5.js ../dist/CrowdsourcingSkeleton/runtime-es5.js ../dist/CrowdsourcingSkeleton/main-es5.js > build/crowdsourcing-task-es5.js \
&& cat ../dist/CrowdsourcingSkeleton/styles.css > build/crowdsourcing-task.css && rm -r ../dist
