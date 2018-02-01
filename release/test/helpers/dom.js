"use strict";
/**
 * This module contains helpers for easy dom manipulation to hide complexities from test cases.
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 *
 * @param typeName
 * @param className
 */
function appendBodyElement(typeName, id, className, innerHTML) {
    return appendElement(document.body, typeName, id, className, innerHTML);
}
exports.appendBodyElement = appendBodyElement;
function appendElement(parent, typeName, id, className, innerHTML) {
    const element = document.createElement(typeName);
    if (className) {
        element.classList.add(className);
    }
    if (id) {
        element.id = id;
    }
    if (innerHTML) {
        element.innerHTML = innerHTML;
    }
    parent.appendChild(element);
    return element;
}
exports.appendElement = appendElement;
