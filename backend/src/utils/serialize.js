// Mongoose subdocuments come back with `_id`, not `id`. The frontend
// standardizes on `id` everywhere. This serializer handles nested arrays
// (e.g. otherAssets[].history[]) so every subdoc at every depth gets a
// proper `id` field — this was the cause of the "Cast to ObjectId failed
// for value undefined" errors on delete/edit of nested items.

function serializeDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: false }) : { ...doc };
  const { _id, __v, ...rest } = obj;

  // Recursively serialize any array fields that contain subdocuments
  for (const key of Object.keys(rest)) {
    if (Array.isArray(rest[key])) {
      rest[key] = rest[key].map(item =>
        item && typeof item === 'object' && (item._id || item.toObject)
          ? serializeDoc(item)
          : item
      );
    } else if (rest[key] instanceof Map) {
      rest[key] = Object.fromEntries(rest[key]);
    }
  }

  return { id: _id ? String(_id) : undefined, ...rest };
}

function serializeList(list) {
  return (list || []).map(serializeDoc);
}

module.exports = { serializeDoc, serializeList };
