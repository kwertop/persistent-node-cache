"use strict";
/*
This wait for event logic is borrowed from wait-for-event package by @jameslnewell
https://github.com/jameslnewell/wait-for-event
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeListener = exports.waitFor = void 0;
const waitFor = (event, emitter, callback) => {
    const promise = new Promise((resolve, reject) => {
        const startListening = () => {
            addListener(emitter, event, handleEvent);
            addListener(emitter, 'error', handleError);
        };
        const stopListening = () => {
            (0, exports.removeListener)(emitter, event, handleEvent);
            (0, exports.removeListener)(emitter, 'error', handleError);
        };
        const handleEvent = () => {
            stopListening();
            resolve();
        };
        const handleError = (error) => {
            stopListening();
            reject(error);
        };
        startListening();
    });
    if (callback) {
        promise.then(() => callback(undefined), (error) => callback(error));
    }
    return promise;
};
exports.waitFor = waitFor;
const addListener = (emitter, event, listener) => {
    if (typeof emitter.on === 'function') {
        emitter.on(event, listener);
    }
    else if (typeof emitter.addListener ===
        'function') {
        emitter.addListener(event, listener);
    }
};
const removeListener = (emitter, event, listener) => {
    if (typeof emitter.off === 'function') {
        emitter.off(event, listener);
    }
    else if (typeof emitter.removeListener === 'function') {
        emitter.removeListener(event, listener);
    }
};
exports.removeListener = removeListener;
