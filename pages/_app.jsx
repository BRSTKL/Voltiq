import "../styles/globals.css";
import "../lib/env";
import Footer from "../components/layout/Footer";
import Navbar from "../components/layout/Navbar";
import AuthSessionProvider from "../components/AuthSessionProvider";

export default function App({ Component, pageProps }) {
  return (
    <AuthSessionProvider session={pageProps.session}>
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <Navbar />
        <div className="flex-1">
          <Component {...pageProps} />
        </div>
        <Footer />
      </div>
    </AuthSessionProvider>
  );
}
