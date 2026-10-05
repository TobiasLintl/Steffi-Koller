import { describe, expect, it } from "vitest";

import {
  backupKey,
  decryptBackup,
  encryptBackup,
  expiredBackupKeys,
} from "@/server/domain/backup/crypto";
import { csvCell, toCsv } from "@/server/domain/export/csv";

describe("CSV export", () => {
  it("escapes separators, quotes and line breaks", () => {
    expect(csvCell('Müller; "Coaching"\nGmbH')).toBe('"Müller; ""Coaching""\nGmbH"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+49 30 123")).toBe("'+49 30 123");
  });

  it("writes a BOM and a header row", () => {
    expect(toCsv([{ a: 1, b: "x" }])).toBe("﻿a;b\r\n1;x\r\n");
  });
});

describe("backup encryption", () => {
  const key = "a-long-test-passphrase-123";

  it("round-trips and detects tampering or wrong keys", () => {
    const plain = Buffer.from("PGDMP fake dump content");
    const encrypted = encryptBackup(plain, key);
    expect(encrypted.includes(plain)).toBe(false);
    expect(decryptBackup(encrypted, key)).toEqual(plain);
    const tampered = Buffer.from(encrypted);
    tampered[40] = tampered[40]! ^ 0xff;
    expect(() => decryptBackup(tampered, key)).toThrow();
    expect(() => decryptBackup(encrypted, "another-long-passphrase")).toThrow();
  });

  it("names backups by time and selects expired ones (30 days)", () => {
    const now = new Date("2026-10-05T02:30:00Z");
    expect(backupKey(now)).toBe("backups/seelenzeit-20261005-023000.dump.enc");
    const keys = [
      "backups/seelenzeit-20260904-023000.dump.enc",
      "backups/seelenzeit-20260906-023000.dump.enc",
      "backups/other.txt",
    ];
    expect(expiredBackupKeys(keys, now, 30)).toEqual([
      "backups/seelenzeit-20260904-023000.dump.enc",
    ]);
  });
});
