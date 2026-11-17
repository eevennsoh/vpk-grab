import { SCREENSHOT_FILE_NAME_PREFIX } from "../constants.js";

const padTwoDigits = (value: number): string => String(value).padStart(2, "0");

export const getScreenshotFileName = (date: Date): string => {
  const datePart = `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;
  const timePart = `${padTwoDigits(date.getHours())}${padTwoDigits(date.getMinutes())}${padTwoDigits(date.getSeconds())}`;
  return `${SCREENSHOT_FILE_NAME_PREFIX}-${datePart}-${timePart}.png`;
};
