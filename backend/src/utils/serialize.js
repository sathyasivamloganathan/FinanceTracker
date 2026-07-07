// Mongoose subdocuments come back with `_id`, not `id`. The frontend (and
// this fix) standardizes on `id` everywhere, so every response that includes
// a list of subdocuments must go through this first — otherwise actions like
// delete/edit silently receive `undefined` as the id and fail (this was the
// cause of the "Cast to ObjectId failed for value undefined" errors).
function serializeDoc(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const { _id, __v, ...rest } = obj;
  return { id: _id ? String(_id) : undefined, ...rest };
}

function serializeList(list) {
  return (list || []).map(serializeDoc);
}

module.exports = { serializeDoc, serializeList };
