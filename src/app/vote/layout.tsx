import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voting Siswa | Pilketos",
};

export default function VoteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[var(--color-vote-surface)] text-neutral-950">{children}</div>
  );
}
