import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Count — Pilketos",
  description: "Tampilan Live Count Real-time Pemilihan Ketua OSIS",
};

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased overflow-x-hidden">
      {children}
    </div>
  );
}
