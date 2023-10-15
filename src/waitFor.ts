/*
This wait for event logic is borrowed from wait-for-event package by @jameslnewell
https://github.com/jameslnewell/wait-for-event
*/

export const waitFor = <Event extends string>(
    event: Event,
    emitter: EventEmitter<Event>,
    callback?: Callback,
): Promise<void> => {
    const promise = new Promise<void>((resolve, reject) => {
        const startListening = (): void => {
            addListener(emitter, event, handleEvent);
            addListener(emitter, 'error', handleError);
        };
  
        const stopListening = (): void => {
            removeListener(emitter, event, handleEvent);
            removeListener(emitter, 'error', handleError);
        };
  
        const handleEvent = (): void => {
            stopListening();
            resolve();
        };
  
        const handleError = (error: any): void => {
            stopListening();
            reject(error);
        };
  
        startListening();
    });
  
    if (callback) {
      promise.then(
        () => callback(undefined),
        (error) => callback(error),
      );
    }

    return promise;
};

const addListener = <Event extends string>(
    emitter: EventEmitterOn<Event> | EventEmitterAddListener<Event>,
    event: Event | 'error',
    listener: EventListener,
): void => {
    if (typeof (emitter as EventEmitterOn<Event>).on === 'function') {
        (emitter as EventEmitterOn<Event>).on(event, listener);
    } else if (
        typeof (emitter as EventEmitterAddListener<Event>).addListener ===
        'function'
    ) {
        (emitter as EventEmitterAddListener<Event>).addListener(event, listener);
    }
};
  
export const removeListener = <Event extends string>(
    emitter: EventEmitterOff<Event> | EventEmitterRemoveListener<Event>,
    event: Event | 'error',
    listener: EventListener,
): void => {
    if (typeof (emitter as EventEmitterOff<Event>).off === 'function') {
        (emitter as EventEmitterOff<Event>).off(event, listener);
    } else if (
        typeof (emitter as EventEmitterRemoveListener<Event>).removeListener === 'function'
    ) {
      (emitter as EventEmitterRemoveListener<Event>).removeListener(
        event,
        listener,
      );
    }
};

interface Callback {
    (error: any): void;
}

interface EventListener {
    (...args: any[]): void;
}
  
interface EventEmitterOn<Event extends string> {
    on(event: Event | 'error', listener: EventListener): void;
}
  
interface EventEmitterOff<Event extends string> {
    off(event: Event | 'error', listener: EventListener): void;
}

interface EventEmitterAddListener<Event extends string> {
    addListener(event: Event | 'error', listener: EventListener): void;
}

interface EventEmitterRemoveListener<Event extends string> {
    removeListener(event: Event | 'error', listener: EventListener): void;
}
  
type EventEmitter<Event extends string> = (
    | EventEmitterOn<Event>
    | EventEmitterAddListener<Event>
) & (EventEmitterOff<Event> | EventEmitterRemoveListener<Event>);