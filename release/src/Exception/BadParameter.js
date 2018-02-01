"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BadParameterException extends Error {
    constructor() {
        super(...arguments);
        this.name = "BadParameterException";
    }
}
exports.BadParameterException = BadParameterException;
