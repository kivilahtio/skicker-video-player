"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PromiseTimeoutException extends Error {
    constructor() {
        super(...arguments);
        this.name = "PromiseTimeoutException";
    }
}
exports.PromiseTimeoutException = PromiseTimeoutException;
//# sourceMappingURL=PromiseTimeout.js.map