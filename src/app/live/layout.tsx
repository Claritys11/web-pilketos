import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Count — Pilketos E-Voting System",
  description: "Tampilan Live Count Real-time Pemilihan Ketua OSIS",
};

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#0B0F17] text-slate-100 antialiased selection:bg-red-500 selection:text-white overflow-x-hidden">
      {/* Background Radial Glow Effects */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(182,37,42,0.15),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_120%,rgba(59,130,246,0.12),rgba(255,255,255,0))]" />
      
      {/* Subtle Grid Lines Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
