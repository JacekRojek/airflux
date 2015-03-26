"use strict";

var _ = require("./utils");

var slice = Array.prototype.slice;

/**
 * Used in `ListenerMethods.js` to create the instance join methods
 * @param {String} strategy Which strategy to use when tracking listenable trigger arguments
 * @returns {Function} An instance method which sets up a join listen on the given listenables using the given strategy
 */
module.exports = function instanceJoinCreator(strategy) {
    return function () {
        _.throwIf(arguments.length < 3, "Cannot create a join with less than 2 listenables!");

        var listenables = slice.call(arguments);
        var callback = listenables.pop();
        var numberOfListenables = listenables.length;
        var join = {
            numberOfListenables: numberOfListenables,
            callback: this[callback] || callback,
            listener: this,
            strategy: strategy
        };
        var cancels = [];

        var i;
        for (i = 0; i < numberOfListenables; ++i) {
            _.throwIf(this.validateListening(listenables[i]));
        }
        for (i = 0; i < numberOfListenables; ++i) {
            cancels.push(listenables[i].listen(newListener(i, join), this));
        }
        reset(join);

        var subobj = { listenable: listenables };
        subobj.stop = makeStopper(subobj, cancels, this);

        this.subscriptions = (this.subscriptions || []).concat(subobj);

        return subobj;
    };
};

// ---- internal join functions ----

function makeStopper(subobj, cancels, context) {
    return function () {
        var i,
            subs = context.subscriptions,
            index = subs ? subs.indexOf(subobj) : -1;
        _.throwIf(index === -1, "Tried to remove join already gone from subscriptions list!");
        for (i = 0; i < cancels.length; ++i) {
            cancels[i]();
        }
        subs.splice(index, 1);
    };
}

function reset(join) {
    join.listenablesEmitted = new Array(join.numberOfListenables);
    join.args = new Array(join.numberOfListenables);
}

function newListener(i, join) {
    return function () {
        var callargs = slice.call(arguments);
        if (join.listenablesEmitted[i]) {
            switch (join.strategy) {
                case "strict":
                    throw new Error("Strict join failed because listener triggered twice.");
                case "last":
                    join.args[i] = callargs;break;
                case "all":
                    join.args[i].push(callargs);
            }
        } else {
            join.listenablesEmitted[i] = true;
            join.args[i] = join.strategy === "all" ? [callargs] : callargs;
        }
        emitIfAllListenablesEmitted(join);
    };
}

function emitIfAllListenablesEmitted(join) {
    for (var i = 0; i < join.numberOfListenables; ++i) {
        if (!join.listenablesEmitted[i]) {
            return;
        }
    }
    join.callback.apply(join.listener, join.args);
    reset(join);
}
/* listenables..., callback*/