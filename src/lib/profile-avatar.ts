import { z } from "zod";
/** Small private profile image; only JPEG data is accepted, never remote URLs or SVG. */
export const profileAvatar = z.string().max(32000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/).refine(value => value.startsWith("data:image/jpeg;base64,/9j/"), "Please choose a JPEG photo.");
