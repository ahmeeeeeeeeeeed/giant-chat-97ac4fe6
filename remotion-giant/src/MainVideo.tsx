import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cairo";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"], subsets: ["arabic"] });

const GREEN = "#10b981";
const DARK = "#0a0f0d";
const DARK2 = "#0f1f1a";
const YELLOW = "#fbbf24";

const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at ${50 + Math.sin(t) * 20}% ${30 + Math.cos(t) * 15}%, ${DARK2} 0%, ${DARK} 70%)`,
    }} />
  );
};

// Phone frame container — renders a screenshot at a given scale, centered.
// Returns its rendered phone dimensions for arrow positioning.
const PHONE_W = 720;
const PHONE_H = (720 * 896) / 414; // ≈ 1558

const PhoneFrame: React.FC<{ src: string; offsetY?: number }> = ({ src, offsetY = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 22 } });
  const scale = interpolate(s, [0, 1], [0.9, 1]);
  return (
    <div style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: `translate(-50%, calc(-50% + ${offsetY}px)) scale(${scale})`,
      opacity: s,
      borderRadius: 56,
      overflow: "hidden",
      boxShadow: `0 30px 120px ${GREEN}55`,
      border: `4px solid ${GREEN}88`,
    }}>
      <Img src={staticFile(src)} style={{ width: PHONE_W, display: "block" }} />
    </div>
  );
};

// Animated arrow pointing to a position on the phone screenshot.
// `targetX`, `targetY` are pixel offsets within the rendered phone (which is PHONE_W × PHONE_H).
// The arrow appears from the right and pulses.
type ArrowProps = {
  targetX: number;
  targetY: number;
  label: string;
  delay?: number;
  fromSide?: "left" | "right";
  phoneOffsetY?: number;
};

const Arrow: React.FC<ArrowProps> = ({ targetX, targetY, label, delay = 0, fromSide = "right", phoneOffsetY = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14 } });
  const pulse = 1 + Math.sin((frame - delay) / 4) * 0.08;

  // Phone is centered at (540, 960 + phoneOffsetY). Top-left of phone is at (540 - PHONE_W/2, 960 - PHONE_H/2 + phoneOffsetY)
  const phoneLeft = 540 - PHONE_W / 2;
  const phoneTop = 960 - PHONE_H / 2 + phoneOffsetY;
  const tx = phoneLeft + targetX;
  const ty = phoneTop + targetY;

  const isRight = fromSide === "right";
  const labelW = 360;
  const labelX = isRight ? tx + 80 : tx - 80 - labelW;
  const labelY = ty - 40;

  const slide = interpolate(s, [0, 1], [isRight ? 60 : -60, 0]);

  return (
    <>
      {/* Pulsing ring on target */}
      <div style={{
        position: "absolute",
        left: tx - 50,
        top: ty - 50,
        width: 100,
        height: 100,
        borderRadius: "50%",
        border: `5px solid ${YELLOW}`,
        opacity: s * 0.9,
        transform: `scale(${pulse})`,
        boxShadow: `0 0 40px ${YELLOW}aa`,
      }} />
      {/* Arrow line + head pointing to target */}
      <svg style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: s }}>
        <defs>
          <marker id={`ah-${delay}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={YELLOW} />
          </marker>
        </defs>
        <line
          x1={isRight ? labelX : labelX + labelW}
          y1={labelY + 50}
          x2={isRight ? tx + 55 : tx - 55}
          y2={ty}
          stroke={YELLOW}
          strokeWidth={6}
          strokeLinecap="round"
          markerEnd={`url(#ah-${delay})`}
        />
      </svg>
      {/* Label */}
      <div style={{
        position: "absolute",
        left: labelX,
        top: labelY,
        width: labelW,
        transform: `translateX(${slide}px)`,
        opacity: s,
        background: YELLOW,
        color: "#000",
        fontFamily,
        fontWeight: 900,
        fontSize: 32,
        padding: "18px 24px",
        borderRadius: 20,
        textAlign: "center",
        direction: "rtl",
        boxShadow: `0 10px 40px ${YELLOW}66`,
      }}>{label}</div>
    </>
  );
};

const StepBadge: React.FC<{ n: number; text: string }> = ({ n, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18 } });
  return (
    <div style={{
      position: "absolute",
      top: 60,
      left: "50%",
      transform: `translateX(-50%) translateY(${interpolate(s, [0, 1], [-40, 0])}px)`,
      opacity: s,
      background: GREEN,
      color: "#000",
      fontFamily,
      fontWeight: 900,
      fontSize: 40,
      padding: "20px 48px",
      borderRadius: 999,
      direction: "rtl",
      display: "flex",
      gap: 20,
      alignItems: "center",
      boxShadow: `0 10px 40px ${GREEN}88`,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: "50%", background: "#000", color: GREEN,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
      }}>{n}</div>
      <div>{text}</div>
    </div>
  );
};

// ============== SCENES ==============

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`, textAlign: "center", direction: "rtl" }}>
        <div style={{ fontFamily, fontWeight: 900, fontSize: 140, color: GREEN, lineHeight: 1 }}>Giant</div>
        <div style={{ fontFamily, fontWeight: 900, fontSize: 64, color: "#fff", marginTop: 40 }}>دليلك السريع</div>
        <div style={{ fontFamily, fontWeight: 400, fontSize: 44, color: "#9ca3af", marginTop: 20 }}>كيف تبدأ في 3 خطوات</div>
      </div>
    </AbsoluteFill>
  );
};

// Step 1: From login page → tap "Sign up" link at bottom
const SceneStep1: React.FC = () => {
  return (
    <AbsoluteFill>
      <StepBadge n={1} text="افتح التطبيق" />
      <PhoneFrame src="images/login.png" offsetY={40} />
      {/* "Sign up" link is at bottom of login page (~y=854 of 896) */}
      <Arrow targetX={355} targetY={1485} label="اضغط هنا لإنشاء حساب" delay={20} fromSide="left" phoneOffsetY={40} />
    </AbsoluteFill>
  );
};

// Step 2: Register page → fill username, password, tap Sign up
const SceneStep2: React.FC = () => {
  return (
    <AbsoluteFill>
      <StepBadge n={2} text="أنشئ حسابك" />
      <PhoneFrame src="images/register.png" offsetY={40} />
      {/* Username field ~ y=256 of 896, Password ~y=347, Sign up button ~y=512 */}
      <Arrow targetX={360} targetY={445} label="اسم المستخدم" delay={15} fromSide="right" phoneOffsetY={40} />
      <Arrow targetX={60} targetY={605} label="كلمة المرور" delay={50} fromSide="left" phoneOffsetY={40} />
      <Arrow targetX={360} targetY={890} label="اضغط تسجيل" delay={85} fromSide="right" phoneOffsetY={40} />
    </AbsoluteFill>
  );
};

// Step 3: Home page with arrows to features
const SceneStep3: React.FC = () => {
  return (
    <AbsoluteFill>
      <StepBadge n={3} text="ابدأ الاستخدام" />
      <PhoneFrame src="images/home.png" offsetY={40} />
      <Arrow targetX={60} targetY={300} label="الدردشات" delay={15} fromSide="left" phoneOffsetY={40} />
      <Arrow targetX={360} targetY={550} label="الغرف الصوتية" delay={50} fromSide="right" phoneOffsetY={40} />
      <Arrow targetX={60} targetY={1300} label="القائمة السفلية" delay={85} fromSide="left" phoneOffsetY={40} />
    </AbsoluteFill>
  );
};

const SceneFeatures: React.FC = () => {
  const items = [
    { icon: "💬", label: "دردشات لحظية" },
    { icon: "🎙️", label: "غرف صوتية حية" },
    { icon: "🎵", label: "موسيقى مشتركة" },
    { icon: "🏆", label: "إنجازات وألعاب" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 32 }}>
      <div style={{ fontFamily, color: GREEN, fontSize: 72, fontWeight: 900, marginBottom: 40, direction: "rtl" }}>كل المميزات</div>
      {items.map((it, i) => <FeatureRow key={i} icon={it.icon} label={it.label} delay={i * 12} />)}
    </AbsoluteFill>
  );
};

const FeatureRow: React.FC<{ icon: string; label: string; delay: number }> = ({ icon, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 15 } });
  return (
    <div style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`, background: "rgba(16,185,129,0.1)", border: `2px solid ${GREEN}55`, borderRadius: 32, padding: "32px 48px", display: "flex", alignItems: "center", gap: 32, direction: "rtl", minWidth: 760 }}>
      <div style={{ fontSize: 80 }}>{icon}</div>
      <div style={{ fontFamily, color: "#fff", fontSize: 52, fontWeight: 700 }}>{label}</div>
    </div>
  );
};

const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ opacity: s, transform: `scale(${interpolate(s, [0, 1], [0.8, 1])})`, textAlign: "center", direction: "rtl" }}>
        <div style={{ fontFamily, fontSize: 64, color: "#fff", fontWeight: 700, marginBottom: 32 }}>حمّل التطبيق الآن</div>
        <div style={{ fontFamily, fontSize: 160, color: GREEN, fontWeight: 900 }}>Giant</div>
        <div style={{ fontFamily, fontSize: 38, color: "#9ca3af", marginTop: 40 }}>giant-chat.lovable.app</div>
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: DARK }}>
      <Bg />
      <Sequence from={0} durationInFrames={90}><SceneIntro /></Sequence>
      <Sequence from={90} durationInFrames={150}><SceneStep1 /></Sequence>
      <Sequence from={240} durationInFrames={210}><SceneStep2 /></Sequence>
      <Sequence from={450} durationInFrames={210}><SceneStep3 /></Sequence>
      <Sequence from={660} durationInFrames={180}><SceneFeatures /></Sequence>
      <Sequence from={840} durationInFrames={120}><SceneCTA /></Sequence>
    </AbsoluteFill>
  );
};
