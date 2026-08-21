import { requireAdmin } from "@/lib/api/auth";
import { csv, handleApiError } from "@/lib/api/response";

const STANDARD_TEMPLATE_ROWS = [
  "student_identifier,student_name,student_class,student_email,voter_type",
  "12345,Nama Siswa 1,XII RPL 1,siswa1@example.com,SISWA",
  "12346,Nama Siswa 2,XII TKJ 1,siswa2@example.com,SISWA",
  "G001,Nama Guru 1,,guru1@example.com,GURU",
];

const WEIGHTED_TEMPLATE_ROWS = [
  "student_name,student_class,student_email,voter_type",
  "Nama Pengurus OSIS,XII RPL 1,osis@example.com,OSIS",
  "Nama Pengurus MPK,XI TKJ 1,mpk@example.com,MPK",
  "Nama Guru,,guru@example.com,GURU",
];

const SIMPLE_EMAIL_TEMPLATE_ROWS = [
  "student_name,student_email",
  "Nama Lengkap 1,pemilih1@example.com",
  "Nama Lengkap 2,pemilih2@example.com",
  "Nama Lengkap 3,pemilih3@example.com",
];

export async function GET(request: Request) {
  try {
    await requireAdmin(["VIEWER", "ADMIN", "SUPER_ADMIN"]);
    const mode = new URL(request.url).searchParams.get("mode");

    if (mode === "WEIGHTED_FIVE") {
      return csv(WEIGHTED_TEMPLATE_ROWS.join("\n"), "template-import-pemilih-berbobot.csv");
    }

    if (mode === "SIMPLE_EMAIL") {
      return csv(SIMPLE_EMAIL_TEMPLATE_ROWS.join("\n"), "template-import-pemilih-sederhana.csv");
    }

    return csv(STANDARD_TEMPLATE_ROWS.join("\n"), "template-import-pemilih-biasa.csv");
  } catch (error) {
    return handleApiError(error);
  }
}
