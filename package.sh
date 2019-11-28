#!/bin/sh
ng build --prod --output-hashing=none && cat dist/CrowdsourcingSkeleton/runtime-es2015.js dist/CrowdsourcingSkeleton/polyfills-es2015.js dist/CrowdsourcingSkeleton/scripts.js dist/CrowdsourcingSkeleton/main-es2015.js > sample/crowdsourcingSkeleton.js && cat dist/CrowdsourcingSkeleton/styles.css > sample/crowdsourcingSkeleton.css
