import { describe, it, expect } from "vitest";
import { gnoToGed, gedToGno } from "../index";

describe("GNO-to-GED Package Smoke Tests", () => {
	describe("Module Exports", () => {
		it("should export gnoToGed function", () => {
			expect(gnoToGed).toBeDefined();
			expect(typeof gnoToGed).toBe("function");
		});

		it("should export gedToGno function", () => {
			expect(gedToGno).toBeDefined();
			expect(typeof gedToGno).toBe("function");
		});
	});

	describe("Basic GED to GNO Conversion", () => {
		it("should handle minimal GEDCOM", async () => {
			const gedcom = `0 HEAD
1 CHAR UTF-8
0 TRLR`;
			const result = await gedToGno(gedcom);
			expect(result).toBeDefined();
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should handle GEDCOM with person", async () => {
			const gedcom = `0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME John /Doe/
0 TRLR`;
			const result = await gedToGno(gedcom);
			expect(result).toBeDefined();
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result.length).toBeGreaterThan(0);
			
			// Verify XML content contains the person
			const decoder = new TextDecoder();
			const xml = decoder.decode(result);
			expect(xml).toContain("John");
			expect(xml).toContain("Doe");
		});

		it("should support compression options", async () => {
			const gedcom = `0 HEAD
1 CHAR UTF-8
0 TRLR`;
			const resultGzip = await gedToGno(gedcom, { gzip: true });
			const resultPlain = await gedToGno(gedcom, {});
			
			expect(resultGzip).toBeDefined();
			expect(resultPlain).toBeDefined();
			// Gzipped should typically be smaller (though not always for tiny data)
			expect(resultGzip).toBeInstanceOf(Uint8Array);
			expect(resultPlain).toBeInstanceOf(Uint8Array);
		});
	});

	describe("Type Safety", () => {
		it("should reject invalid file path for gnoToGed", async () => {
			// Test that invalid file path throws error
			await expect(gnoToGed("dummy.gno")).rejects.toThrow();
		});

		it("should reject invalid buffer data for gnoToGed", async () => {
			const buffer = Buffer.from("invalid xml data");
			await expect(gnoToGed(buffer)).rejects.toThrow();
		});

		it("should reject invalid Uint8Array data for gnoToGed", async () => {
			const arr = new Uint8Array([1, 2, 3]);
			await expect(gnoToGed(arr)).rejects.toThrow();
		});
	});
});

