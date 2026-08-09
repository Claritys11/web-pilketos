import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required for seeding.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const isProduction = process.env.NODE_ENV === "production";
const seedAdminUsername = process.env.SEED_ADMIN_USERNAME?.trim() || "superadmin";
const seedAdminEmail = process.env.SEED_ADMIN_EMAIL?.trim() || "superadmin@pilketos.local";
const seedAdminPassword = resolveSeedAdminPassword();

function resolveSeedAdminPassword() {
  const password =
    process.env.SEED_ADMIN_PASSWORD || (isProduction ? undefined : "PilketosAdmin123");
  if (!password || password.length < 12) {
    throw new Error(
      "SEED_ADMIN_PASSWORD wajib diisi minimal 12 karakter untuk bootstrap Super Admin.",
    );
  }
  return password;
}

async function main() {
  let superAdmin = await prisma.admin.findUnique({
    where: { username: seedAdminUsername },
  });

  if (!superAdmin) {
    const passwordHash = await argon2.hash(seedAdminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    superAdmin = await prisma.admin.create({
      data: {
        username: seedAdminUsername,
        email: seedAdminEmail,
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });
  }

  let election = await prisma.election.findUnique({
    where: { id: "seed-election-pilketos-2026" },
  });
  const createdElection = !election;

  if (!election) {
    election = await prisma.election.create({
      data: {
        id: "seed-election-pilketos-2026",
        title: "Pilketos 2025/2026",
        description: "Data dummy untuk pengembangan awal sistem Pilketos.",
        status: "SETUP",
        createdById: superAdmin.id,
      },
    });
  }

  const candidates = [
    {
      orderNumber: 1,
      name: "Budi Santoso",
      className: "XI IPA 1",
      photoUrl: null,
      vision: "Mewujudkan OSIS yang aktif, terbuka, dan dekat dengan aspirasi siswa.",
      missions: [
        "Membuka forum aspirasi siswa setiap bulan.",
        "Mengadakan program pelatihan kepemimpinan untuk pengurus kelas.",
        "Meningkatkan transparansi kegiatan dan anggaran OSIS.",
      ],
    },
    {
      orderNumber: 2,
      name: "Siti Rahma",
      className: "XI IPS 2",
      photoUrl: null,
      vision: "Membangun lingkungan sekolah yang kreatif, inklusif, dan kolaboratif.",
      missions: [
        "Menyelenggarakan pekan kreativitas lintas ekstrakurikuler.",
        "Membuat kanal laporan dan ide kegiatan siswa.",
        "Memperkuat kolaborasi OSIS dengan MPK dan ekstrakurikuler.",
      ],
    },
    {
      orderNumber: 3,
      name: "Raka Pratama",
      className: "X MIPA 3",
      photoUrl: null,
      vision: "Menjadikan OSIS sebagai penggerak budaya disiplin dan prestasi.",
      missions: [
        "Mendorong program apresiasi prestasi akademik dan non-akademik.",
        "Membuat kampanye disiplin positif bersama wali kelas.",
        "Mengadakan mentoring antarangkatan untuk siswa baru.",
      ],
    },
  ];

  for (const candidate of candidates) {
    await prisma.candidate.upsert({
      where: {
        electionId_orderNumber: {
          electionId: election.id,
          orderNumber: candidate.orderNumber,
        },
      },
      update: {
        photoUrl: candidate.photoUrl,
      },
      create: {
        ...candidate,
        electionId: election.id,
      },
    });
  }

  if (createdElection) {
    await prisma.auditLog.create({
      data: {
        actorId: superAdmin.id,
        action: "ELECTION_CREATED",
        targetType: "election",
        targetId: election.id,
        result: "SUCCESS",
        metadata: {
          source: "seed",
          candidateCount: candidates.length,
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
