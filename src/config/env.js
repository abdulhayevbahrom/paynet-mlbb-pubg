function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === "") {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function numberEnv(name, fallback) {
  const value = Number(required(name, fallback));

  if (Number.isNaN(value)) {
    throw new Error(`Env must be a number: ${name}`);
  }

  return value;
}

function numberListEnv(name, fallback = "") {
  return required(name, fallback)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => !Number.isNaN(item));
}

export const env = {
  port: numberEnv("PORT", "8070"),
  mongoUri: required("MONGO_URI"),
  paynet: {
    login: required("PAYNET_LOGIN"),
    password: required("PAYNET_PASSWORD"),
    serviceIds: numberListEnv("PAYNET_SERVICE_IDS", "3,4"),
    mlbbServiceId: numberEnv("PAYNET_MLBB_SERVICE_ID", "3"),
    pubgServiceId: numberEnv("PAYNET_PUBG_SERVICE_ID", "4"),
  },
  telegram: {
    botToken: required("BOT_TOKEN"),
    adminIds: numberListEnv("ADMIN_IDS", ""),
    mlbbGroupId: required("TG_GROUP_ID_MLBB"),
    pubgGroupId: required("TG_GROUP_ID_PUBG"),
  },
  gw: {
    baseUrl: required("GW_API_BASE_URL", "https://api.sonofutred.com"),
    apiKey: required("GW_API_KEY"),
    timeoutMs: numberEnv("GW_API_TIMEOUT_MS", "30000"),
  },
};
