/**
 * Recursively set object properties on obj. Path is a slash separate path.
 */
export const setProperty = (obj, path, value) => {
  const s = path.split('/', 2)
  const k = s[0]
  if (s.length === 2) {
    if (!obj[k]) {
      obj[k] = {}
    }
    obj[k] = setProperty(obj[k], s[1], value)
  } else {
    obj[k] = value
  }
  return obj
}
