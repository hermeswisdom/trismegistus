export type AccountMode = "sign-in" | "sign-up";

export type AccountFormInput = {
  email: string;
  password: string;
  name?: string;
  mode: AccountMode;
};

export type AccountFormResult =
  | { ok: true; email: string; password: string; name: string }
  | { ok: false; error: string };

export function parseAccountForm(input: AccountFormInput): AccountFormResult {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = (input.name ?? "").replace(/\s+/g, " ").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "The hall needs a real email." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Eight characters at least. A small lock." };
  }
  if (input.mode === "sign-up" && name.length < 2) {
    return { ok: false, error: "Give the wall a name to keep." };
  }
  return { ok: true, email, password, name };
}
