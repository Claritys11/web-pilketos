import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Count — Pilketos E-Voting System",
  description: "Tampilan Live Count Real-time Pemilihan Ketua OSIS",
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-screen bg-[#f6f3f2] text-[#1b1c1c] antialiased overflow-hidden">
      {/* Subtle warm ambient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#ffdad6]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#c5e7ff]/20 blur-3xl" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
