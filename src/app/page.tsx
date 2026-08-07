import Image from "next/image";
import Link from "next/link";

const currentYear = new Date().getFullYear();

const navItems = [
  { label: "Beranda", href: "#home" },
  { label: "Panduan", href: "#panduan" },
  { label: "Prosedur", href: "#prosedur" },
  { label: "Galeri", href: "#galeri" },
  { label: "Video", href: "#video" },
];

const heroImages = [
  "/e-pilketos-copy/images/dokum/DSC02226.webp",
  "/e-pilketos-copy/images/dokum/2024/IMG_4851.webp",
  "/e-pilketos-copy/images/dokum/2024/IMG_4863.webp",
  "/e-pilketos-copy/images/dokum/2024/DSC_3589.webp",
  "/e-pilketos-copy/images/dokum/2024/DSC_3570.webp",
];

const guideCards = [
  {
    image: "/e-pilketos-copy/images/Icon1.png",
    title: "Token Pemilih",
    body: "Pastikan token yang kamu masukkan sesuai dengan token resmi yang dikirim oleh panitia.",
  },
  {
    image: "/e-pilketos-copy/images/Icon2.png",
    title: "Koneksi Stabil",
    body: "Gunakan perangkat bilik voting yang sudah disiapkan agar proses berjalan lancar.",
  },
  {
    image: "/e-pilketos-copy/images/Icon3.png",
    title: "Hak Suara",
    body: "Setiap pemilih hanya mendapat satu kesempatan untuk menggunakan hak suaranya.",
  },
  {
    image: "/e-pilketos-copy/images/Icon4.png",
    title: "Kenali Kandidat",
    body: "Baca detail kandidat, visi, dan misi sebelum kamu menentukan pilihan.",
  },
  {
    image: "/e-pilketos-copy/images/Icon5.png",
    title: "Bantuan Panitia",
    body: "Jika ada kendala, hubungi panitia penjaga bilik tanpa membagikan token ke orang lain.",
  },
  {
    image: "/e-pilketos-copy/images/Icon6.png",
    title: "Tidak Dapat Diulang",
    body: "Suara yang sudah dikirim akan langsung tercatat dan token tidak bisa digunakan lagi.",
  },
];

const procedureSteps = [
  "Klik tombol Vote",
  "Masukkan token pemilih",
  "Masuk ke mode layar penuh",
  "Baca visi dan misi kandidat",
  "Pilih dan konfirmasi suara",
  "Hak suara berhasil digunakan",
];

const galleryImages = [
  "/e-pilketos-copy/images/dokum/DSC02089.webp",
  "/e-pilketos-copy/images/dokum/DSC02218.webp",
  "/e-pilketos-copy/images/dokum/DSC02239.webp",
  "/e-pilketos-copy/images/dokum/DSC02262.webp",
  "/e-pilketos-copy/images/dokum/DSC02279.webp",
  "/e-pilketos-copy/images/dokum/DSC02311.webp",
];

const footerColumns = [
  {
    title: "Media Sosial",
    links: [
      { label: "Instagram", href: "https://www.instagram.com/smktelkommalang/" },
      { label: "YouTube", href: "https://www.youtube.com/@smktelkommalang" },
      { label: "TikTok", href: "https://www.tiktok.com/@smktelkommalang" },
    ],
  },
  {
    title: "Organisasi",
    links: [
      { label: "OSIS", href: "https://www.moklet.org/organisasi/2023-2025/OSIS" },
      { label: "MPK", href: "https://www.moklet.org/organisasi/2023-2025/MPK" },
      { label: "METIC", href: "https://www.moklet.org/organisasi/2023-2025/METIC" },
    ],
  },
  {
    title: "Didukung Oleh",
    links: [
      { label: "MokletDev", href: "https://github.com/mokletdev" },
      { label: "SMK Telkom Malang", href: "https://www.smktelkom-mlg.sch.id/" },
    ],
  },
];

const footerLogos = [
  ["/e-pilketos-copy/logo-mpk.png", "Logo MPK"],
  ["/e-pilketos-copy/logo-osis.png", "Logo OSIS"],
  ["/e-pilketos-copy/logo-ts.png", "Logo SMK Telkom"],
] as const;

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fff6f6] text-neutral-950">
      <header className="fixed inset-x-0 top-0 z-40 px-4 py-3">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full bg-white px-4 shadow-lg shadow-red-950/5 sm:px-6">
          <Link href="#home" className="flex items-center gap-3">
            <Image
              src="/e-pilketos-copy/logo-mpk.png"
              alt="Logo MPK"
              width={48}
              height={48}
              className="h-11 w-11 object-contain"
              priority
            />
            <span className="hidden text-base font-bold text-neutral-950 sm:block">E-Pilketos</span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-semibold text-neutral-700 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition hover:text-[var(--color-vote-primary)]"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <Link
            href="/vote"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-vote-primary)] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-primary-700)]"
          >
            Vote
          </Link>
        </nav>
      </header>

      <section id="home" className="px-5 pb-20 pt-32 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:min-h-[720px] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            <h1 className="text-5xl font-bold leading-[1.12] text-neutral-950 sm:text-6xl">
              Pemilihan Ketua OSIS SMK Telkom Malang {currentYear}
            </h1>
            <p className="mt-7 text-lg leading-8 text-neutral-600">
              Pemilihan ini berdampak besar untuk masa depan SMK Telkom Malang. Gunakan hak suaramu
              dengan aman, tertib, dan penuh tanggung jawab.
            </p>
            <div className="mt-9 flex justify-center lg:justify-start">
              <Link
                href="/vote"
                className="inline-flex h-14 items-center justify-center rounded-lg bg-[var(--color-vote-primary)] px-8 text-base font-bold text-white shadow-lg shadow-red-900/15 transition hover:bg-[var(--color-primary-700)]"
              >
                Yuk Vote Sekarang!
              </Link>
            </div>
          </div>

          <div className="relative hidden min-h-[650px] lg:block">
            <div className="absolute left-0 top-0 flex flex-col gap-5">
              {heroImages.slice(0, 3).map((image, index) => (
                <div
                  key={image}
                  className="relative h-[190px] w-[255px] overflow-hidden rounded-lg bg-red-100 shadow-lg shadow-red-950/10"
                >
                  <Image
                    src={image}
                    alt={`Dokumentasi Pilketos ${index + 1}`}
                    fill
                    sizes="255px"
                    className="object-cover"
                    priority={index === 0}
                  />
                </div>
              ))}
            </div>
            <div className="absolute right-4 top-32 flex flex-col gap-5 xl:right-16">
              {heroImages.slice(3).map((image, index) => (
                <div
                  key={image}
                  className="relative h-[240px] w-[280px] overflow-hidden rounded-lg bg-red-100 shadow-lg shadow-red-950/10"
                >
                  <Image
                    src={image}
                    alt={`Dokumentasi Pilketos ${index + 4}`}
                    fill
                    sizes="280px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="panduan" className="bg-white px-5 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold text-neutral-950 sm:text-5xl">Panduan</h2>
            <p className="mt-6 text-lg leading-8 text-neutral-600">
              Sebelum melakukan vote, ada beberapa hal yang harus diperhatikan.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {guideCards.map((guide) => (
              <article
                key={guide.title}
                className="flex items-start gap-6 rounded-lg bg-neutral-50 p-6 shadow-md shadow-neutral-950/5"
              >
                <Image
                  src={guide.image}
                  alt={guide.title}
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-lg object-contain"
                />
                <div>
                  <h3 className="text-xl font-bold text-neutral-950">{guide.title}</h3>
                  <p className="mt-3 text-base leading-7 text-neutral-600">{guide.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="prosedur" className="bg-[#fff6f6] px-5 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Image
            src="/e-pilketos-copy/images/ProsedurSection.svg"
            alt="Ilustrasi prosedur voting"
            width={560}
            height={560}
            className="mx-auto h-auto w-full max-w-xl"
          />
          <div>
            <h2 className="text-4xl font-bold text-neutral-950 sm:text-5xl">Prosedur</h2>
            <p className="mt-6 text-lg leading-8 text-neutral-600">
              Pastikan hak suara kamu terhitung dengan mengikuti tata cara yang disediakan.
            </p>
            <ol className="mt-9 space-y-5">
              {procedureSteps.map((step, index) => (
                <li key={step} className="flex items-center gap-6">
                  <span
                    className={`grid h-13 w-13 shrink-0 place-items-center rounded-full text-base font-bold ${
                      index === 1
                        ? "bg-[var(--color-vote-primary)] text-white"
                        : "border border-[var(--color-vote-primary)] bg-white text-[var(--color-vote-primary)]"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-lg font-semibold leading-7 text-neutral-900">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="galeri" className="bg-white px-5 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold text-neutral-950 sm:text-5xl">Galeri</h2>
            <p className="mt-6 text-lg leading-8 text-neutral-600">
              Lihat para Mokleters menggunakan hak suaranya untuk memilih Ketua OSIS berikutnya.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {galleryImages.map((image, index) => (
              <div
                key={image}
                className={`relative overflow-hidden rounded-lg bg-red-100 shadow-md shadow-neutral-950/5 ${
                  index === 0 ? "sm:col-span-2 lg:col-span-1" : ""
                } aspect-[4/3]`}
              >
                <Image
                  src={image}
                  alt={`Galeri Pilketos ${index + 1}`}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="video" className="bg-[#fff6f6] px-5 py-24 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="text-center lg:text-left">
            <h2 className="text-4xl font-bold text-neutral-950 sm:text-5xl">
              Selain Foto Ada Juga Videonya
            </h2>
            <p className="mt-6 text-lg leading-8 text-neutral-600">
              Dokumentasi kegiatan Pilketos menjadi pengingat bahwa setiap suara punya peran untuk
              membentuk budaya demokrasi di sekolah.
            </p>
            <Link
              href="/vote"
              className="mt-9 inline-flex h-13 items-center justify-center rounded-lg bg-[var(--color-vote-primary)] px-7 text-base font-bold text-white shadow-sm transition hover:bg-[var(--color-primary-700)]"
            >
              Vote Sekarang
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg bg-neutral-950 shadow-xl shadow-red-950/10">
            <iframe
              src="https://www.youtube.com/embed/o73LgJXZGF4?si=R6r9TA4Hl-J2eA5C"
              title="Dokumentasi Pilketos"
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <footer className="bg-white px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center gap-12">
            {footerLogos.map(([src, alt]) => (
              <Image
                key={src}
                src={src}
                alt={alt}
                width={72}
                height={72}
                className="h-16 w-16 object-contain"
              />
            ))}
          </div>

          <div className="mt-14 grid gap-10 border-t border-neutral-200 pt-12 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="font-bold text-neutral-950">{column.title}</h3>
                <div className="mt-5 grid gap-3">
                  {column.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-neutral-600 transition hover:text-[var(--color-vote-primary)] hover:underline"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-12 border-t border-neutral-200 pt-8 text-center text-sm text-neutral-500">
            © {currentYear} MokletDev. Adapted for Pilketos.
          </p>
        </div>
      </footer>
    </main>
  );
}
