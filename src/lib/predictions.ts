// Shared identity logic for comments — used by src/lib/community.ts and the
// API routes under src/app/api/predictions/* (that path is a holdover name;
// those endpoints handle sign-in/name/email, not the old prediction game).
// The file name and the Predictor model name are also holdovers: this site
// used to run a "when will this resolve" prediction game on the same
// identity system. That feature has been removed; only comments remain.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export class PredictionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const hit = await prisma.predictor.findFirst({
    where: {
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
      OR: [
        { displayName: { equals: name, mode: "insensitive" } },
        { agentName: { equals: name, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return hit != null;
}

// Everyone starts anonymous with a random, playful, temporary handle like
// "CopperFalcon48" that says nothing about who they are.
async function generateAnonymousHandle(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const handle = adjective + noun + (10 + Math.floor(Math.random() * 90));
    if (!(await nameTaken(handle))) return handle;
  }
  return "Guest" + randomBytes(3).toString("hex");
}

const ADJECTIVES = [
  "Steady", "Patient", "Curious", "Bright", "Quiet", "Swift", "Amber", "Northern", "Coastal", "Prairie",
  "Alpine", "Golden", "Silver", "Cedar", "Copper", "Bold", "Calm", "Keen", "Vivid", "Lively",
  "Sunny", "Brisk", "Noble", "Clever", "Nimble", "Sturdy", "Cheerful", "Mellow", "Plucky", "Dapper",
];
const NOUNS = [
  "Heron", "Otter", "Falcon", "Badger", "Lynx", "Osprey", "Beaver", "Moose", "Kestrel", "Raven",
  "Fox", "Wren", "Bison", "Egret", "Marten", "Lighthouse", "Turbine", "Compass", "Harbor", "Summit",
  "Canyon", "Meadow", "Comet", "Ridge", "Pine", "Willow", "Finch", "Elk", "Crane", "Owl",
];

// One identity for everything a person does on this site: comments and
// likes all hang off the same Predictor row, keyed by the browser's
// anonymous key. New people get an anonymous handle; choosing a real name
// is a separate, email-gated step (see chooseDisplayName).
export async function getOrCreateHumanPredictor(anonymousKey: string) {
  const existing = await prisma.predictor.findUnique({ where: { anonymousKey } });
  if (existing?.displayName) return existing;
  const displayName = await generateAnonymousHandle();
  if (existing) return prisma.predictor.update({ where: { id: existing.id }, data: { displayName } });
  return prisma.predictor.create({ data: { anonymousKey, displayName } });
}

const RESERVED_NAME = /^(anon|anonymous|guest|admin|administrator|moderator|mod|staff|official|support|system|waitingforpower)\b/i;
// Looks like an auto-assigned handle (CopperFalcon48); those can't be chosen.
const HANDLE_SHAPE = /^[A-Z][a-z]+[A-Z][a-z]+\d{2,3}$/;
const GUEST_SHAPE = /^Guest[0-9a-f]{6}$/;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,22}[A-Za-z0-9]$/;

// Only a person who has confirmed an email can pick their own public name,
// once. Everyone else stays anonymous, so a name always means someone who
// can be reached and tied to one profile.
export async function chooseDisplayName(anonymousKey: string, rawName: string) {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!NAME_PATTERN.test(name)) {
    throw new PredictionError("invalid_name", "Use 3 to 24 letters, numbers, spaces, dots, dashes or underscores.");
  }
  if (RESERVED_NAME.test(name) || HANDLE_SHAPE.test(name) || GUEST_SHAPE.test(name)) {
    throw new PredictionError("reserved_name", "That name is reserved. Pick another.");
  }

  const predictor = await prisma.predictor.findUnique({ where: { anonymousKey } });
  if (!predictor) throw new PredictionError("not_found", "Post something first.");
  if (!predictor.email) throw new PredictionError("email_required", "Confirm your email to choose a name.");
  if (predictor.nameChosenAt) throw new PredictionError("already_chosen", "Your name is already set and can't be changed.");
  if (await nameTaken(name, predictor.id)) throw new PredictionError("name_taken", "That name is taken. Pick another.");

  return prisma.predictor.update({ where: { id: predictor.id }, data: { displayName: name, nameChosenAt: new Date(), identityDecidedAt: predictor.identityDecidedAt ?? new Date() },
  });
}

// A first-time poster's posts are held (visible only to them) until they
// decide how to appear. Choosing to continue as their anonymous handle is
// one way to decide; confirming an email or choosing a name are the others.
export async function decideIdentity(anonymousKey: string) {
  const predictor = await prisma.predictor.findUnique({ where: { anonymousKey } });
  if (!predictor) throw new PredictionError("not_found", "Post something first.");
  if (predictor.identityDecidedAt) return predictor;
  return prisma.predictor.update({ where: { id: predictor.id }, data: { identityDecidedAt: new Date() } });
}
