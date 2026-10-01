/** Auth.js (next-auth v5): Google creates and signs in accounts; an optional password signs in the same account. */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { getUserById } from "../db/queries";
import { upsertGoogleUser } from "../db/queries/account";
import { clientIp } from "./auth-rules";
import { authenticatePassword } from "./credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/welcome", error: "/welcome" },
  providers: [
    Google, // AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are read from the environment
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const id = await authenticatePassword(credentials, clientIp(request.headers));
        return id ? { id } : null;
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      return Boolean(profile?.sub && profile.email && profile.email_verified);
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "google" && profile?.sub && profile.email) {
        const row = await upsertGoogleUser({ sub: profile.sub, email: profile.email, name: profile.name });
        return { uid: row.id, onboarded: row.onboardedAt !== null };
      }
      if (account?.provider === "credentials" && user?.id) {
        const row = await getUserById(user.id);
        return { uid: user.id, onboarded: row?.onboardedAt != null };
      }
      // Until onboarding is done, re-check on each read so finishing it takes effect without signing in again.
      if (token.uid && !token.onboarded) {
        const row = await getUserById(token.uid);
        token.onboarded = row?.onboardedAt != null;
      }
      return token;
    },
    async session({ session, token }) {
      // Only the id and the onboarding flag travel in the session. Name, email and gender are read from the database.
      session.user = { id: token.uid ?? "", onboarded: token.onboarded ?? false } as typeof session.user;
      return session;
    },
  },
});
