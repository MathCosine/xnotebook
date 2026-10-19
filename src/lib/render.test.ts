import { describe, expect, it } from "vitest";
import { hasMath, plainText, renderNote } from "./render";

describe("renderNote", () => {
  it("escapes HTML so notes can't inject markup", () => {
    expect(renderNote('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
  it("handles light markdown", () => {
    expect(renderNote("**Osmosis** is *passive*, see `ch4`")).toBe("<strong>Osmosis</strong> is <em>passive</em>, see <code>ch4</code>");
  });
  it("doesn't treat prices as math", () => {
    expect(hasMath("costs $5 and $10")).toBe(false);
    expect(hasMath("$F = ma$")).toBe(true);
    expect(hasMath("$$E = mc^2$$")).toBe(true);
  });
});

describe("plainText", () => {
  it("makes LaTeX readable for previews and search", () => {
    expect(plainText("$6\\text{CO}_2 \\rightarrow \\text{O}_2$")).toBe("6CO2 → O2");
    expect(plainText("**Mitosis** makes $\\frac{1}{2}$")).toBe("Mitosis makes 1/2");
  });
});
