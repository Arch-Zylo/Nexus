/**
 * Binds every prototype method of `obj` to `obj`, so methods can be handed around
 * as callbacks (event listeners, timers, the overlay stack…) without losing `this`.
 * The bound function is created once, so its identity is stable (the overlay stack
 * relies on that to find the entry it should close).
 */
export function autoBind(obj) {
  for (let p = Object.getPrototypeOf(obj); p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
    for (const name of Object.getOwnPropertyNames(p)) {
      if (name === 'constructor' || Object.prototype.hasOwnProperty.call(obj, name)) continue;
      const d = Object.getOwnPropertyDescriptor(p, name);
      if (d && typeof d.value === 'function') obj[name] = d.value.bind(obj);
    }
  }
}

/**
 * Base class of every service and feature view.
 *  - `this.app`   the composition root (App); reach other components as `this.app.<name>`
 *  - `this.state` the persisted user data (shortcut for `this.app.store.state`)
 *  - `init()`     called once by App.start() to wire DOM events / apply initial state
 */
export class Component {
  /** @param {import('./App.js').App} app */
  constructor(app) {
    this.app = app;
    autoBind(this);
  }
  get state() { return this.app.store.state; }
  set state(v) { this.app.store.state = v; }
  init() {}
}
