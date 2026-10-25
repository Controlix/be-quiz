import { describe, it, expect } from "vitest";
import fs from "fs";

describe("ActionToolbar - Decoupled Registration", () => {
  it("does not evaluate window.confirm inside the mail link onClick", () => {
    const file = fs.readFileSync("src/components/ActionToolbar.tsx", "utf-8");
    expect(file).not.toContain('window.confirm("Heb je de mail verzonden naar de organisatie?")');
  });

  it("contains decoupled confirmation button and undo controls", () => {
    const file = fs.readFileSync("src/components/ActionToolbar.tsx", "utf-8");
    expect(file).toContain("Mail verzonden? Bevestig registratie");
    expect(file).toContain("Inschrijving heropenen / annuleren");
  });
});
