import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");

      if (isOnAdmin) {
        if (!isLoggedIn) {
          return false;
        }

        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
        const userEmail = auth?.user?.email?.toLowerCase();

        if (!adminEmail || userEmail !== adminEmail) {
          return Response.redirect(new URL("/", nextUrl));
        }

        return true;
      }

      if (isLoggedIn) {
        return true;
      }

      return Response.redirect(
        new URL(
          `/login?callbackUrl=${encodeURIComponent(
            nextUrl.pathname + nextUrl.search
          )}`,
          nextUrl
        )
      );
    },
  },
  providers: [],
} satisfies NextAuthConfig;
