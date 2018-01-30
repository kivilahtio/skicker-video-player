/**
 * This module contains helpers for easy dom manipulation to hide complexities from test cases.
 */

/**
 *
 * @param typeName
 * @param className
 */

export function appendBodyElement(typeName: string, id?: string, className?: string): Element {
  const element: Element = document.createElement(typeName);
  if (className) {
    element.classList.add(className);
  }
  if (id) {
    element.id = id;
  }
  document.body.appendChild(element);

  return element;
}
