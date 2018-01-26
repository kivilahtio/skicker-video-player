/**
 * This module contains helpers for easy dom manipulation to hide complexities from test cases.
 */

/**
 *
 * @param typeName
 * @param className
 */

export function appendBodyElement(typeName: string, className: string): Element {
  const element: Element = document.createElement(typeName);
  element.classList.add(className);
  document.body.appendChild(element);

  return element;
}
