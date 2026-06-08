export function computeElementLengthFromCiiVector(dx, dy, dz) {
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function mapElementLengthsByToNode(elements) {
  const map = new Map();
  for (const el of elements) {
    if (el.toNode && el.dx != null && el.dy != null && el.dz != null) {
      map.set(el.toNode, computeElementLengthFromCiiVector(el.dx, el.dy, el.dz));
    }
  }
  return map;
}
