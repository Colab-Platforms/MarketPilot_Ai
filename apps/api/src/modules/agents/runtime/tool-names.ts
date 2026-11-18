// Providers accept only [a-zA-Z0-9_-] in function names, so 'brain.search' travels as 'brain__search'.
export function toModelToolName(name: string): string {
  return name.replace(/\./g, '__');
}

export function fromModelToolName(name: string): string {
  return name.replace(/__/g, '.');
}
