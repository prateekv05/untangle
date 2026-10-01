import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: { id: string; onboarded: boolean };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    onboarded?: boolean;
  }
}
