import { createServerFn } from "@tanstack/react-start";
import { productionGrokAuthConfigured } from "./production-oauth";

export type AuthDoors = {
  oauthEnabled: boolean;
};

export const getAuthDoors = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthDoors> => ({
    oauthEnabled: productionGrokAuthConfigured(process.env),
  }),
);
