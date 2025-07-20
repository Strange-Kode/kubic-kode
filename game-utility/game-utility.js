// Recursively serializes any object, handling nested class instances via toJSON
export function serializeRecursively(obj, visited = new WeakSet()) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Prevent circular references
  if (visited.has(obj)) {
    return "[Circular Reference]";
  }
  visited.add(obj);

  if (typeof obj.toJSON === "function") {
    return serializeRecursively(obj.toJSON(), visited);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeRecursively(item, visited));
  }

  const serialized = {};
  for (const [key, value] of Object.entries(obj)) {
    serialized[key] = serializeRecursively(value, visited);
  }

  return serialized;
}

// Generates a random session ID
export function generateSessionId(length = 16) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

// Pauses execution for given milliseconds (can help with async tasks)
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pickProperties(source, props) {
  return props.reduce((obj, key) => {
    obj[key] = source[key];
    return obj;
  }, {});
}
