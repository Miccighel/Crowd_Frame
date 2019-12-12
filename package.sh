#!/bin/sh
ng build --prod --output-hashing=none && \
cat dist/CrowdsourcingSkeleton/polyfills-es2015.js dist/CrowdsourcingSkeleton/runtime-es2015.js dist/CrowdsourcingSkeleton/main-es2015.js > sample/task/crowdsourcingSkeleton-es2015.js && \
cat dist/CrowdsourcingSkeleton/polyfills-es5.js dist/CrowdsourcingSkeleton/runtime-es5.js dist/CrowdsourcingSkeleton/main-es5.js > sample/task/crowdsourcingSkeleton-es5.js \
&& cat dist/CrowdsourcingSkeleton/styles.css > sample/task/crowdsourcingSkeleton.css && cat src/assets/hits.json > sample/task/hits.json && rm -r dist
