#!/bin/sh

ng build --prod --output-hashing=none && \
cat ../dist/CrowdsourcingSkeleton/polyfills-es2015.js ../dist/CrowdsourcingSkeleton/runtime-es2015.js ../dist/CrowdsourcingSkeleton/main-es2015.js ../dist/CrowdsourcingSkeleton/styles-es2015.js ../dist/CrowdsourcingSkeleton/scripts.js ../dist/CrowdsourcingSkeleton/assets/lib/annotator.js > build/scripts.js  \
&& cat ../dist/CrowdsourcingSkeleton/styles.css > build/styles.css && rm -r ../dist

