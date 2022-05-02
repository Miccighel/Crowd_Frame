exports.Task = extend(TolokaHandlebarsTask, function (options) {
    TolokaHandlebarsTask.call(this, options);
}, {
    onRender: function () {
        // DOM element for task is formed (available via #getDOMElement())
    },
    onDestroy: function () {
        // Task is completed. Global resources can be released (if used)
    }
});

function extend(ParentClass, constructorFunction, prototypeHash) {
    constructorFunction = constructorFunction || function () {
    };
    prototypeHash = prototypeHash || {};
    if (ParentClass) {
        constructorFunction.prototype = Object.create(ParentClass.prototype);
    }
    for (var i in prototypeHash) {
        constructorFunction.prototype[i] = prototypeHash[i];
    }
    return constructorFunction;
}
