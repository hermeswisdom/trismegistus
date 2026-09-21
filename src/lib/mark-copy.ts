export function markNameHint(input: {
  signedIn: boolean;
  name: string;
}): string {
  const name = input.name.trim();
  if (input.signedIn && name) {
    return `Leaves as ${name}. Private on the tablet — the board stays unnamed.`;
  }
  return "A name for this tablet. A kept name stays private on the board.";
}

export function leftMarkCopy(input: {
  signedIn: boolean;
  name: string;
}): string {
  const name = input.name.trim() || "you";
  if (input.signedIn) {
    return `Left as ${name}. The board stays unnamed.`;
  }
  return `Left as ${name}.`;
}
