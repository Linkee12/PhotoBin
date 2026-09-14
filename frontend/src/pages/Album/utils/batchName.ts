const ADJECTIVES = [
  "Red",
  "Blue",
  "Green",
  "Golden",
  "Silver",
  "Violet",
  "Amber",
  "Coral",
  "Ivory",
  "Scarlet",
  "Quiet",
  "Brave",
  "Clever",
  "Gentle",
  "Happy",
  "Jolly",
  "Lucky",
  "Merry",
  "Proud",
  "Swift",
  "Sunny",
  "Misty",
  "Frosty",
  "Stormy",
  "Dusty",
  "Rusty",
  "Shiny",
  "Sleepy",
  "Witty",
  "Zesty",
];
const ANIMALS = [
  "Monkey",
  "Otter",
  "Falcon",
  "Panda",
  "Tiger",
  "Koala",
  "Badger",
  "Heron",
  "Lynx",
  "Moose",
  "Raven",
  "Wolf",
  "Fox",
  "Owl",
  "Bear",
  "Hare",
  "Seal",
  "Crane",
  "Bison",
  "Gecko",
  "Llama",
  "Puffin",
  "Robin",
  "Salmon",
  "Sparrow",
  "Turtle",
  "Walrus",
  "Weasel",
  "Yak",
  "Zebra",
];

function pick<T>(list: T[]): T {
  // Display label only, nothing security-relevant depends on it.
  // eslint-disable-next-line sonarjs/pseudo-random
  return list[Math.floor(Math.random() * list.length)];
}

/** A random, human-friendly label for an upload batch, e.g. `QuietOtter`. */
export function randomBatchName(): string {
  return pick(ADJECTIVES) + pick(ANIMALS);
}
