import { PrismaAdapter } from "@auth/prisma-adapter";
import { Plan } from "@prisma/client";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

import { authConfig } from "@/auth.config";
import prisma from "@/lib/prisma";

const resendFromAddress = "Voltiq <onboarding@resend.dev>";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "",
      from: resendFromAddress,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, email }) {
      if (email?.verificationRequest) {
        return true;
      }

      if (!user.email) {
        return false;
      }

      const emailVerified =
        "emailVerified" in user ? user.emailVerified ?? null : null;

      await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          emailVerified,
          plan: Plan.FREE,
        },
        update: {
          ...(user.name ? { name: user.name } : {}),
          ...(user.image ? { image: user.image } : {}),
          ...(emailVerified ? { emailVerified } : {}),
        },
      });

      return true;
    },
    async session({ session, user }) {
      if (!session.user) {
        return session;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          plan: true,
        },
      });

      session.user.id = dbUser?.id ?? user.id;
      session.user.plan = dbUser?.plan ?? Plan.FREE;

      return session;
    },
  },
});
