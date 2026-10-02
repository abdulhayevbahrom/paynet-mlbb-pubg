import axios from "axios";

const CHECK_ROLE_URL = "https://www.smile.one/merchant/mobilelegends/checkrole";

export async function checkMlbbAccount({ userId, zoneId }) {
  const { data } = await axios.post(CHECK_ROLE_URL, {
    user_id: userId,
    zone_id: zoneId,
  });

  if (data?.code === 201) {
    return {
      exists: false,
      username: null,
    };
  }

  return {
    exists: true,
    username: data?.username || "",
  };
}
