import Head from "next/head";
import Scope2Calculator from "@/components/tools/Scope2Calculator";

export default function Scope2Page() {
  return (
    <>
      <Head>
        <title>Scope 2 Calculator - Voltiq</title>
        <meta
          name="description"
          content="Corporate Scope 2 GHG emissions calculation for ESG reporting with location-based and market-based methods, RE instruments, and SBTi tracking."
        />
      </Head>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Scope2Calculator />
      </main>
    </>
  );
}
