#!/bin/sh
ng build --prod --output-hashing=none && \
cat dist/CrowdsourcingSkeleton/runtime-es2015.js dist/CrowdsourcingSkeleton/polyfills-es2015.js dist/CrowdsourcingSkeleton/scripts.js dist/CrowdsourcingSkeleton/main-es2015.js > sample/crowdsourcingSkeleton-es2015.js && \
cat dist/CrowdsourcingSkeleton/runtime-es5.js dist/CrowdsourcingSkeleton/polyfills-es5.js dist/CrowdsourcingSkeleton/scripts.js dist/CrowdsourcingSkeleton/main-es5.js > sample/crowdsourcingSkeleton-es5.js \
&& cat dist/CrowdsourcingSkeleton/styles.css > sample/crowdsourcingSkeleton.css
