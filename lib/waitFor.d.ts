export declare const waitFor: <Event extends string>(event: Event, emitter: EventEmitter<Event>, callback?: Callback) => Promise<void>;
export declare const removeListener: <Event extends string>(emitter: EventEmitterOff<Event> | EventEmitterRemoveListener<Event>, event: Event | "error", listener: EventListener) => void;
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
type EventEmitter<Event extends string> = (EventEmitterOn<Event> | EventEmitterAddListener<Event>) & (EventEmitterOff<Event> | EventEmitterRemoveListener<Event>);
export {};
