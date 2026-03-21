import "../styles/globals.css";
import Footer from "../components/layout/Footer";
import Navbar from "../components/layout/Navbar";

export default function App({ Component, pageProps }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <Navbar />
      <div className="flex-1">
        <Component {...pageProps} />
      </div>
      <Footer />
    </div>
  );
}
