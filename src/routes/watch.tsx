import { createFileRoute, Link } from "@tanstack/react-router";
import videoAsset from "../../public/videos/giant-promo.mp4.asset.json";

export const Route = createFileRoute("/watch")({
  head: () => ({
    meta: [
      { title: "شاهد فيديو Giant — جولة في التطبيق" },
      { name: "description", content: "فيديو ترويجي قصير يشرح تطبيق Giant: دردشات لحظية، غرف صوتية، موسيقى مشتركة، وإنجازات." },
      { property: "og:title", content: "شاهد فيديو Giant" },
      { property: "og:description", content: "جولة قصيرة داخل تطبيق Giant." },
      { property: "og:video", content: videoAsset.url },
      { property: "og:type", content: "video.other" },
    ],
  }),
  component: WatchPage,
});

function WatchPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0f0d] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-emerald-400">شاهد جولة Giant</h1>
        <p className="text-center text-gray-400 mb-6">فيديو قصير يعرض أبرز مميزات التطبيق</p>
        <div className="rounded-3xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl shadow-emerald-500/20 bg-black">
          <video
            src={videoAsset.url}
            controls
            playsInline
            poster=""
            className="w-full h-auto block"
          />
        </div>
        <div className="mt-6 flex gap-3 justify-center">
          <a
            href={videoAsset.url}
            download="giant-promo.mp4"
            className="px-5 py-3 rounded-full bg-emerald-500 text-black font-bold"
          >
            تنزيل الفيديو
          </a>
          <Link to="/" className="px-5 py-3 rounded-full border border-emerald-500/40 text-emerald-300">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
