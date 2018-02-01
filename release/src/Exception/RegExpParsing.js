"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RegExpParsingException extends Error {
    constructor() {
        super(...arguments);
        this.name = "RegExpParsingException";
    }
}
exports.RegExpParsingException = RegExpParsingException;
