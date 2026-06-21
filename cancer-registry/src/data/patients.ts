export type Gender = "Laki-laki" | "Perempuan";

export type Patient = {
  nama: string;
  noErm: string;
  tahun: number;
  jk: Gender;
  usia: number;
  pendidikanTerakhir: string;
  pekerjaan: string;
  noHp: string;
  nik: string;
  leader: string;
};

export const PATIENTS: Patient[] = [
  {
    nama: "Ahmad Fauzi",
    noErm: "ERM-000123",
    tahun: 2025,
    jk: "Laki-laki",
    usia: 34,
    pendidikanTerakhir: "SMA",
    pekerjaan: "Karyawan Swasta",
    noHp: "0812-3456-7890",
    nik: "3276010101010001",
    leader: "Dr. Sari",
  },
  {
    nama: "Dewi Lestari",
    noErm: "ERM-000456",
    tahun: 2024,
    jk: "Perempuan",
    usia: 28,
    pendidikanTerakhir: "S1",
    pekerjaan: "Perawat",
    noHp: "0821-2345-6789",
    nik: "3174010202020002",
    leader: "Dr. Budi",
  },
  {
    nama: "Rizky Pratama",
    noErm: "ERM-000789",
    tahun: 2026,
    jk: "Laki-laki",
    usia: 41,
    pendidikanTerakhir: "S2",
    pekerjaan: "Wiraswasta",
    noHp: "0852-1111-2222",
    nik: "3201010303030003",
    leader: "Dr. Sari",
  },
];

