import { requireAdmin } from "@/lib/api/auth";
import { csv, handleApiError } from "@/lib/api/response";

const TEMPLATE_ROWS = [
  "student_identifier,student_name,student_class,student_email,voter_type",
  "12345,Nama Siswa 1,XII RPL 1,siswa1@example.com,SISWA",
  "12346,Nama Siswa 2,XII TKJ 1,siswa2@example.com,SISWA",
  "G001,Nama Guru 1,Guru,guru1@example.com,GURU",
];

export async function GET() {
  try {
    await requireAdmin(["VIEWER", "ADMIN", "SUPER_ADMIN"]);
    return csv(TEMPLATE_ROWS.join("\n"), "template-import-pemilih-pilketos.csv");
  } catch (error) {
    return handleApiError(error);
  }
}
