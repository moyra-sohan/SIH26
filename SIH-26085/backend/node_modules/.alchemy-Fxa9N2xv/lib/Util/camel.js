import { isPlainObject } from "./data.js";
export const camelCaseKey = (key) => key
    .replace(/^_+/, "")
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
export const toCamelCase = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => toCamelCase(item));
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
            camelCaseKey(key),
            toCamelCase(nested),
        ]));
    }
    return value;
};
//# sourceMappingURL=camel.js.map