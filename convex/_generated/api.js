// Mocked api utility to replace Convex generated code.
// Intercepts any property path access and returns its string key path.
const makeProxy = (path = []) => {
  return new Proxy(
    Object.assign(() => {}, { path }),
    {
      get(target, prop) {
        if (prop === "name" || prop === "_path") {
          return path.join(":");
        }
        if (prop === "toString" || prop === Symbol.toPrimitive) {
          return () => path.join(":");
        }
        // Support some default function properties if checked
        if (typeof prop === "symbol") {
          return undefined;
        }
        return makeProxy([...path, prop]);
      }
    }
  );
};

export const api = makeProxy([]);
export const internal = api;
export const components = {};
