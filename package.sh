#!/bin/sh
ng build --prod --output-hashing=none && \
cat dist/FakeNews2020/polyfills-es2015.js dist/FakeNews2020/runtime-es2015.js dist/FakeNews2020/main-es2015.js > sample/task/crowdsourcing-task-es2015.js && \
cat dist/FakeNews2020/polyfills-es5.js dist/FakeNews2020/runtime-es5.js dist/FakeNews2020/main-es5.js > sample/task/crowdsourcing-task-es5.js \
&& cat dist/FakeNews2020/styles.css > sample/task/crowdsourcing-task.css && rm -r dist
