import { fail } from "assert";

export const env = {
  MICHAELS_USER: process.env.MICHAELS_USER ?? fail("missing MICHAEL_USER"),
  MICHAELS_PASS: process.env.MICHAELS_PASS ?? fail("missing MICHAEL_PASS"),
  // if empty string, default to undefined
  MICHAELS_ADDRESS: process.env.MICHAELS_ADDRESS || undefined,
};
