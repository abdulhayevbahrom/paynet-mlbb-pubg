import Counter from "../models/counter.model.js";

export async function getNextSequence(key) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return counter.seq;
}
