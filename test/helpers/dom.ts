/**
 * This module contains helpers for easy dom manipulation to hide complexities from test cases.
 */

/**
 *
 * @param typeName
 * @param className
 */

export function appendBodyElement(typeName: string, id?: string, className?: string, innerHTML?: string): HTMLElement {
  return appendElement(document.body, typeName, id, className, innerHTML);
}

export function appendElement(parent: HTMLElement, typeName: string, id?: string, className?: string, innerHTML?: string): HTMLElement {
  const element: HTMLElement = document.createElement(typeName);
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
