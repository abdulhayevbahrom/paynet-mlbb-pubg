import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export function tashkentTimestamp(date = new Date()) {
  return dayjs(date).tz("Asia/Tashkent").format("YYYY-MM-DD HH:mm:ss");
}

export function tashkentTransactionTimestamp(date = new Date()) {
  return dayjs(date).tz("Asia/Tashkent").format("ddd MMM DD HH:mm:ss [UZT] YYYY");
}
