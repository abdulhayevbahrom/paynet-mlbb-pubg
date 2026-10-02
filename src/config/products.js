import { env } from "./env.js";

export const games = {
  mlbb: {
    key: "mlbb",
    title: "MLBB",
    serviceId: env.paynet.mlbbServiceId,
    groupId: env.telegram.mlbbGroupId,
    quantityLabel: "diamonds",
  },
  pubg: {
    key: "pubg",
    title: "PUBG",
    serviceId: env.paynet.pubgServiceId,
    groupId: env.telegram.pubgGroupId,
    quantityLabel: "UC",
  },
};

export const gameList = Object.values(games);
