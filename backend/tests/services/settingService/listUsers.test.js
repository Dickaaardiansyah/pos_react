// tests/services/settingService/listUsers.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.listUsers (SATU FUNGSI SAJA)
// Daftar user publik (tanpa password), termasuk nonaktif, urut nama.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require("bcryptjs");
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const { settingService } = require("../../../services/settingService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase(); // admin_test + kasir_test
});

async function insertUser({ username, name, role = "cashier", isActive = 1 }) {
  const pool = getPool();
  const hash = bcrypt.hashSync("rahasia123", 4);
  const [result] = await pool.query(
    `INSERT INTO users (name, username, password, role, is_active) VALUES (?, ?, ?, ?, ?)`,
    [name, username, hash, role, isActive],
  );
  return result.insertId;
}

describe("settingService.listUsers", () => {
  test("setelah resetDatabase minimal ada 2 user seed (admin + kasir)", async () => {
    const users = await settingService.listUsers();
    expect(users.length).toBeGreaterThanOrEqual(2);
    const usernames = users.map((u) => u.username);
    expect(usernames).toContain("admin_test");
    expect(usernames).toContain("kasir_test");
  });

  test("response TIDAK berisi field password", async () => {
    const users = await settingService.listUsers();
    for (const u of users) {
      expect(u.password).toBeUndefined();
    }
  });

  test("termasuk user nonaktif", async () => {
    await insertUser({
      username: "nonaktif1",
      name: "User Nonaktif",
      isActive: 0,
    });
    const users = await settingService.listUsers();
    const found = users.find((u) => u.username === "nonaktif1");
    expect(found).toBeDefined();
    expect(Number(found.is_active)).toBe(0);
  });

  test("diurutkan berdasarkan name ASC", async () => {
    await insertUser({ username: "z_user", name: "Zebra User" });
    await insertUser({ username: "a_user", name: "Alpha User" });

    const users = await settingService.listUsers();
    const names = users.map((u) => u.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});
