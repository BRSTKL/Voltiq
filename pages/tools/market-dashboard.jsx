import Head from "next/head";
import MarketDashboard from "../../components/tools/MarketDashboard";

export default function MarketDashboardPage() {
  return (
    <>
      <Head>
        <title>Türkiye PTF Dashboard | Voltiq</title>
        <meta
          name="description"
          content="Canlı EPİAŞ gün öncesi fiyat verisi, saatlik PTF grafikleri ve 24 saatlik tahmin."
        />
      </Head>
      <MarketDashboard />
    </>
  );
}
