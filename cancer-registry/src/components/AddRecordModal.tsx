"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Row = Record<string, string>;

function buildScratchRow(
  headers: string[],
  values: {
    nama: string;
    noErm: string;
    nik: string;
    jk: string;
    usia: string;
    tahun: string;
    pendidikan: string;
    pekerjaan: string;
    noHp: string;
  },
): Row {
  const row: Row = { NAMA: values.nama, "NO ERM": values.noErm };

  const setByNeedle = (needle: string, value: string) => {
    if (!value) return;
    const header = headers.find((h) => h.toLowerCase().includes(needle));
    if (header) row[header] = value;
  };

  setByNeedle("nik", values.nik);
  setByNeedle("jk", values.jk);
  setByNeedle("usia", values.usia);
  setByNeedle("tahun", values.tahun);
  setByNeedle("pendidikan", values.pendidikan);
  setByNeedle("pekerjaan", values.pekerjaan);
  setByNeedle("no hp", values.noHp);

  return row;
}

export function AddRecordModal({
  headers,
  onCreate,
  onClose,
}: {
  headers: string[];
  onCreate: (row: Row) => void;
  onClose: () => void;
}) {
  const [nama, setNama] = React.useState("");
  const [noErm, setNoErm] = React.useState("");
  const [nik, setNik] = React.useState("");
  const [jk, setJk] = React.useState("");
  const [usia, setUsia] = React.useState("");
  const [tahun, setTahun] = React.useState("");
  const [pendidikan, setPendidikan] = React.useState("");
  const [pekerjaan, setPekerjaan] = React.useState("");
  const [noHp, setNoHp] = React.useState("");

  const canSubmit = nama.trim() && noErm.trim();

  function handleSubmit() {
    if (!canSubmit) return;
    const row = buildScratchRow(headers, {
      nama: nama.trim(),
      noErm: noErm.trim(),
      nik: nik.trim(),
      jk,
      usia: usia.trim(),
      tahun: tahun.trim(),
      pendidikan: pendidikan.trim(),
      pekerjaan: pekerjaan.trim(),
      noHp: noHp.trim(),
    });
    onCreate(row);
  }

  return (
    <div className="fixed inset-0 z-20 bg-black/30 p-4 backdrop-blur-sm">
      <div className="mx-auto max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Tambah data baru
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              Isi identitas pasien untuk membuat data baru dari awal.
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Nama *"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama lengkap"
            />
          </div>
          <Input
            label="No ERM *"
            value={noErm}
            onChange={(e) => setNoErm(e.target.value)}
            placeholder="Nomor ERM"
          />
          <Input
            label="NIK"
            value={nik}
            onChange={(e) => setNik(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-800">JK</label>
            <select
              value={jk}
              onChange={(e) => setJk(e.target.value)}
              className="h-11 w-full rounded-xl bg-white px-3.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="">-</option>
              <option value="Laki - Laki">Laki - Laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>
          <Input
            label="Usia"
            value={usia}
            onChange={(e) => setUsia(e.target.value)}
          />
          <Input
            label="Tahun"
            value={tahun}
            onChange={(e) => setTahun(e.target.value)}
          />
          <Input
            label="Pendidikan terakhir"
            value={pendidikan}
            onChange={(e) => setPendidikan(e.target.value)}
          />
          <Input
            label="Pekerjaan"
            value={pekerjaan}
            onChange={(e) => setPekerjaan(e.target.value)}
          />
          <Input
            label="No HP"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
          <span className="mr-auto text-xs text-zinc-500">
            * wajib diisi
          </span>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            Buat data
          </Button>
        </div>
      </div>
    </div>
  );
}
