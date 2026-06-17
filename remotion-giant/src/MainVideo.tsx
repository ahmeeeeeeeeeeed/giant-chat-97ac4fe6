import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cairo";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["arabic"] });

const GREEN = "#10b981";
const DARK = "#0a0f0d";
const DARK2 = "#0f1f1a";

const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at ${50 + Math.sin(t) * 20}% ${30 + Math.cos(t) * 15}%, ${DARK2} 0%, ${DARK} 70%)`,
    }} />
  );
};

const Title: React.FC<{ text: string; sub?: string }> = ({ text, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18 } });
  const y = interpolate(s, [0, 1], [60, 0]);
  return (
    <div style={{ opacity: s, transform: `translateY(${y}px)`, textAlign: "center", direction: "rtl" }}>
      <div style={{ fontFamily, fontWeight: 900, fontSize: 110, color: "#fff", lineHeight: 1.1 }}>{text}</div>
      {sub && <div style={{ fontFamily, fontWeight: 400, fontSize: 44, color: GREEN, marginTop: 24 }}>{sub}</div>}
    </div>
  );
};

const Scene1: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
    <Title text="Giant" sub="مجتمعك الكامل في تطبيق واحد" />
  </AbsoluteFill>
);

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 20 } });
  const scale = interpolate(s, [0, 1], [0.85, 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${scale})`, opacity: s, borderRadius: 48, overflow: "hidden", boxShadow: `0 30px 120px ${GREEN}55`, border: `3px solid ${GREEN}66` }}>
        <Img src={staticFile("images/home.png")} style={{ width: 720, display: "block" }} />
      </div>
      <div style={{ fontFamily, color: "#fff", fontSize: 56, marginTop: 60, fontWeight: 700, direction: "rtl" }}>واجهة عربية أنيقة</div>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ icon: string; label: string; delay: number }> = ({ icon, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 15 } });
  const y = interpolate(s, [0, 1], [40, 0]);
  return (
    <div style={{ opacity: s, transform: `translateY(${y}px)`, background: "rgba(16,185,129,0.1)", border: `2px solid ${GREEN}55`, borderRadius: 32, padding: "32px 48px", display: "flex", alignItems: "center", gap: 32, direction: "rtl", minWidth: 700 }}>
      <div style={{ fontSize: 72 }}>{icon}</div>
      <div style={{ fontFamily, color: "#fff", fontSize: 48, fontWeight: 700 }}>{label}</div>
    </div>
  );
};

const Scene3: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36 }}>
    <div style={{ fontFamily, color: GREEN, fontSize: 64, fontWeight: 900, marginBottom: 40, direction: "rtl" }}>المميزات</div>
    <Feature icon="💬" label="دردشات لحظية" delay={0} />
    <Feature icon="🎙️" label="غرف صوتية حية" delay={12} />
    <Feature icon="🎵" label="موسيقى مشتركة" delay={24} />
    <Feature icon="🏆" label="إنجازات وألعاب" delay={36} />
  </AbsoluteFill>
);

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ transform: `scale(${scale})`, opacity: s, textAlign: "center", direction: "rtl" }}>
        <div style={{ fontFamily, fontSize: 56, color: "#fff", fontWeight: 400, marginBottom: 40 }}>حمّل التطبيق الآن</div>
        <div style={{ fontFamily, fontSize: 140, color: GREEN, fontWeight: 900 }}>Giant</div>
        <div style={{ fontFamily, fontSize: 38, color: "#9ca3af", marginTop: 32 }}>giant-chat.lovable.app</div>
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: DARK }}>
      <Bg />
      <Sequence from={0} durationInFrames={120}><Scene1 /></Sequence>
      <Sequence from={120} durationInFrames={150}><Scene2 /></Sequence>
      <Sequence from={270} durationInFrames={210}><Scene3 /></Sequence>
      <Sequence from={480} durationInFrames={120}><Scene4 /></Sequence>
    </AbsoluteFill>
  );
};
